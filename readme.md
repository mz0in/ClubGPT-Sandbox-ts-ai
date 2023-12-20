# ClubGPT - Sandbox

## AI Developer / Developer team (ClubGPT) powered by GPT-3.5/4-Turbo & OpenAI's AI Assistant API

Member of the [ClubGPT](https://ClubGPT.vip) family.
Check out how a whole team of AI Agents could work for you on the [ClubGPT](https://github.com/matebenyovszky/ClubGPT) repository.

The AI developer agent(s) perform user's tasks in the user's GitHub repository including:
- create a new repo
- reading files
- writing code, making changes
- making pull requests
- pulling GitHub repository
- responding to the user's feedback to the agent's previous work.
- running commands (so anything that can be accessed as a command)
- testing the code if possible

All agent's work is happening inside the [E2B sandbox](https://e2b.dev/docs).
The custom E2B sandbox environment is defined in the [`e2b.Dockerfile`](./e2b.Dockerfile)

The E2B's sandboxes are isolated cloud environments made specifically for AI apps and agents. Inside the sandbox AI agents perform long-running tasks, run code in a secure cloud environment, and use the same tools as a human developer would use.

## Getting started
1. Run `npm install`
1. Copy `.env.example` and save it as `.env` file
1. Add your OpenAI API key to `.env`
1. Get E2B API Key at [https://e2b.dev/docs/getting-started/api-key](https://e2b.dev/docs/getting-started/api-key)
    - Save it to `.env`
1. Run `npm run create-ai-assistant` to create the AI assistant using OpenAI's new Assistant API (if you haven't already)
1. Check assistant created here [https://platform.openai.com/assistants](https://platform.openai.com/assistants)
    - You will be able to select from your assistant
1. Create classic GitHub token [here](https://github.com/settings/tokens) and give it the `read:org` and `repo` permissions
    - Save the GitHub token to `.env`
1. Save your GitHub username to `.env`

## Run AI Developer

Run the following command in terminal and follow instructions
```bash
npm run start
```
## Update AI Developer

If you make changes to the description in at [https://platform.openai.com/assistants](https://platform.openai.com/assistants)
 Will remove: `functions.ts`, you can update the AI by running the following command in the terminal:
```bash
npm run update-ai-assistant
```