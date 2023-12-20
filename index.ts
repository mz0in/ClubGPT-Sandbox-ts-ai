import 'dotenv/config'

import OpenAI from 'openai'
import prompts from 'prompts'
import ora from 'ora'
import { MessageContentText } from 'openai/resources/beta/threads'
import { Sandbox } from '@e2b/sdk'

import { onLog } from './log'
import { cloneRepo, loginWithGH, listLastEditedRepos, createRepo } from './gh'
import { sleep } from './sleep'
import { listFiles, makeCommit, makeDir, makePullRequest, readFile, saveCodeToFile, runCode, runPowershellCommand } from './actions'

import { listAIDeveloper } from './aiAssistant-list'

const openai = new OpenAI()

//const AI_ASSISTANT_ID = process.env.AI_ASSISTANT_ID!

async function initChat(): Promise<{ repoName: string; task: string; mode: string; AI_ASSISTANT_ID: string  }> {
  let { mode } = (await prompts({
    type: 'select',
    name: 'mode',
    message: 'Choose mode:',
    choices: [
      { title: 'Work in a repo', value: 'repo' },
      { title: 'Just run code or commands', value: 'chit-chat' },
    ],
  })) as any

  // Function to prompt the user to select an AI assistant and return the selected assistant's ID
  async function selectAIAssistant(): Promise<string> {
    // Fetch the list of AI assistants
    const aiAssistants = await listAIDeveloper();

    // Create a list of choices for the prompt
    const aiChoices = aiAssistants.map((assistant, index) => ({
      title: assistant.name,
      value: index,
    }));

    let { selectedAI } = (await prompts({
      type: 'select',
      name: 'selectedAI',
      message: 'Choose an AI assistant:',
      choices: aiChoices,
    })) as any;

    // Return the ID of the selected AI assistant
    return aiAssistants[selectedAI].id;
  }

  let repoName = '';
  let task = '';

  // Set the selected AI assistant
  let AI_ASSISTANT_ID = await selectAIAssistant();

  if (mode === 'repo') {

    await loginWithGH(sandbox)

    let { repoOption } = (await prompts({
      type: 'select',
      name: 'repoOption',
      message: 'Choose an option for setting the repo:',
      choices: [
        { title: 'Select a repo from last 10', value: 'select' },
        { title: 'Create a new repo', value: 'create' },
        { title: 'Enter a repo name manually', value: 'manual' },
      ],
    })) as any;

    switch (repoOption) {
      case 'create':
        let { newRepoName } = (await prompts({
          type: 'text',
          name: 'newRepoName',
          message: 'Enter new repo name:',
        })) as any;
        let username = process.env.GIT_USERNAME;
        await createRepo(sandbox, newRepoName);
        repoName = `${username}/${newRepoName}`;
        break;
      case 'select':
        let repos = await listLastEditedRepos(sandbox);  
        let repoChoices = repos.map((repo, index) => ({
          title: repo,
          value: index,
        }));
        let { selectedRepo } = (await prompts({
          type: 'select',
          name: 'selectedRepo',
          message: 'Select a repo:',
          choices: repoChoices,
        })) as any;
        repoName = repos[selectedRepo];
        break;
      case 'manual':
        let { manualRepoName } = (await prompts({
          type: 'text',
          name: 'manualRepoName',
          message: 'Enter repo name (eg: username/repo):',
        })) as any;
        repoName = manualRepoName.replace(/\\/g, '/');
        break;
    }

    await cloneRepo(sandbox, repoName)

    let { task } = (await prompts({
      type: 'text',
      name: 'task',
      message: 'Enter the task you want the AI developer to work on:',
    })) as any;
  }
  return { repoName, task, mode, AI_ASSISTANT_ID }
}
  
function createThread(repoURL: string, task: string, mode: string) {
  let content;
  if (mode === 'repo') {
    content = `Pull this repo: '${repoURL}'. Then carefully plan this task and start working on it: ${task}`;
  } else if (mode === 'chit-chat') {
    content = `Enter your first command or code:`;
  } else {
    content = 'Enter your first command or code:';
  }
  return openai.beta.threads.create({
    messages: [
      {
        'role': 'user',
        'content': content,
      }
    ]
  })
}

const sandbox = await Sandbox.create({
  id: 'ai-developer-sandbox',
  onStdout: onLog,
  onStderr: onLog,
})

sandbox
  .addAction(readFile)
  .addAction(makeCommit)
  .addAction(makePullRequest)
  .addAction(saveCodeToFile)
  .addAction(makeDir)
  .addAction(listFiles)
  .addAction(runCode)
  .addAction(runPowershellCommand)

const { repoName, task, mode, AI_ASSISTANT_ID } = await initChat()

const spinner = ora('Waiting for assistant')
spinner.start()

const thread = await createThread(repoName, task, mode)
const assistant = await openai.beta.assistants.retrieve(AI_ASSISTANT_ID)

let run = await openai.beta.threads.runs.create(thread.id, {
  assistant_id: assistant.id,
})

assistantLoop: while (true) {
  await sleep(1000)

  switch (run.status) {
    case 'requires_action': {
      spinner.stop()
      const outputs = await sandbox.openai.actions.run(run)
      spinner.start()

      if (outputs.length > 0) {
        await openai.beta.threads.runs.submitToolOutputs(thread.id, run.id, {
          tool_outputs: outputs,
        })
      }

      break
    }
    case 'completed': {
      spinner.stop()
      const messages = await openai.beta.threads.messages.list(thread.id)
      const textMessages = messages.data[0].content.filter(message => message.type === 'text') as MessageContentText[]
      const { userResponse }: { userResponse: string } = await prompts({
        type: 'text',
        name: 'userResponse',
        message: `${textMessages[0].text.value}\nIf you want to exit write 'exit', otherwise write your response:\n`,
      })
      if (userResponse === 'exit') {
        break assistantLoop
      }
      spinner.start()

      await openai.beta.threads.messages.create(thread.id, {
        role: 'user',
        content: userResponse as string,
      })

      run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: assistant.id,
      })

      break
    }
    case 'queued':
    case 'in_progress':
      break
    case 'cancelled':
    case 'cancelling':
    case 'expired':
    case 'failed':
      break assistantLoop
    default:
      console.error(`Unknown status: ${run.status}`)
      break assistantLoop
  }

  run = await openai.beta.threads.runs.retrieve(thread.id, run.id)
}

spinner.stop()
await sandbox.close()