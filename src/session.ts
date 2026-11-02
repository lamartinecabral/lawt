import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type OpenAI from "openai";
import { isRecord } from "./utils.ts";

type Message = OpenAI.ChatCompletionMessageParam;

export class Session {
  messages: Message[] = [];
  readonly resumed: boolean;
  private pendingSaves = 0;

  constructor(messages: Message[], resume = false) {
    const lastMessages = (resume ? loadSession : () => {})();
    this.resumed = lastMessages !== undefined;
    this.messages = lastMessages ?? messages;
    this.pendingSaves = this.resumed ? 0 : this.messages.length;
  }
  push = (message: Message) => {
    this.messages.push(message);
    this.pendingSaves++;
    // it should only save new messages after a response
    if (message.role === "user") return;
    if (this.pendingSaves === this.messages.length) saveSession(this.messages);
    else this.messages.slice(-this.pendingSaves).forEach(saveMessage);
    this.pendingSaves = 0;
  };
}

const sessionsDirectory = () =>
  path.join(process.env.HOME || os.homedir(), ".lawt", "sessions");

export const sessionPath = () => {
  const workingDirectory = process.cwd();
  return path.join(
    sessionsDirectory(),
    `${encodeURIComponent(path.resolve(workingDirectory))}.jsonl`,
  );
};

const loadSession = (): Message[] | undefined => {
  try {
    const source = fs.readFileSync(sessionPath(), "utf8");
    return source
      .trim()
      .split("\n")
      .map((line) => {
        const message = JSON.parse(line);
        if (!isMessage(message)) throw new Error("Invalid json");
        return message;
      });
  } catch (_) {
    return undefined;
  }
};

const saveSession = (messages: Message[]) => {
  fs.mkdirSync(path.dirname(sessionPath()), { recursive: true });
  fs.writeFileSync(sessionPath(), "", "utf8");
  for (const message of messages) {
    saveMessage(message);
  }
};

const saveMessage = (message: Message) => {
  fs.appendFileSync(sessionPath(), `${JSON.stringify(message)}\n`, "utf8");
};

const isMessage = (value: unknown): value is Message =>
  isRecord(value) &&
  ["system", "user", "assistant", "tool", "developer"].includes(
    String(value.role),
  );
