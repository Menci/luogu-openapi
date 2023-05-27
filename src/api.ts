import { promisify } from "node:util"
import { gunzip } from "node:zlib";
import fetch from "node-fetch";
import { v4 as uuid } from "uuid";
import { WebSocket } from "ws";

import { HttpGetJudgeResultResponse, HttpSubmitJudgeRequest, JudgeRecord, JudgeRequest, JudgeStatus, ProblemInfo, ProblemInfoRaw } from "./types";

export async function fetchProblemsRaw() {
  const LUOGU_PROBLEMS_URL = "https://cdn.luogu.com.cn/problemset-open/latest.ndjson.gz";
  const response = await fetch(LUOGU_PROBLEMS_URL);
  if (!response.ok) throw new Error(`Error: HTTP status ${response.status}, ${await response.text()}`);
  const gzipped = await response.buffer();
  const ndjson = (await promisify(gunzip)(gzipped)).toString("utf-8");
  return ndjson.split("\n").filter(line => line).map<ProblemInfoRaw>(line => JSON.parse(line));
}

export async function fetchProblems() {
  return (await fetchProblemsRaw()).map<ProblemInfo>(entry => ({
    pid: entry.pid,
    title: entry.title,
    background: entry.background,
    description: entry.description,
    inputFormat: entry.inputFormat,
    outputFormat: entry.outputFormat,
    translation: entry.translation,
    samples: entry.samples,
    hint: entry.hint,
    timeLimit: Math.max(...entry.limits.time),
    memoryLimit: Math.max(...entry.limits.memory),
    tags: entry.tags
  }));
}

export class LuoguOpenApiClient {
  private readonly LUOGU_OPENAPI_PREFIX = "https://open-v1.lgapi.cn";
  private readonly LUOGU_OPENAPI_WEBSOCKET = "wss://open-ws.lgapi.cn/ws";

  private readonly POLL_RESULT_INTERVAL = 1000;
  private readonly POLL_RESULT_MIN_HANG_TIME = 10000;

  private readonly httpAuthorization: string;
  private readonly runningJudge: Map<string, {
    requestId: string;
    lastUpdateTime: number;
  }> = new Map();

  private ws: WebSocket;
  private pollResultTimer: NodeJS.Timer;
  private stopped = false;

  /**
   * @param token `${user}:${pass}`
   */
  constructor(
    private readonly token: string,
    private readonly onJudgeProgress: (trackId: string, data: JudgeRecord) => void,
  ) {
    this.httpAuthorization = "Basic " + Buffer.from(token, "ascii").toString("base64");
    this.pollResultTimer = setTimeout(() => this.pollJudgeResult(), this.POLL_RESULT_INTERVAL);
  }

  private async call<TRequest, TResponse>(method: "GET" | "POST", api: string, body?: TRequest): Promise<TResponse> {
    const response = await fetch(this.LUOGU_OPENAPI_PREFIX + api, {
      method,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers: {
        "Content-Type": "application/json",
        Authorization: this.httpAuthorization
      }
    });
    if (!response.ok) throw new Error(`Error: HTTP status ${response.status}, ${await response.text()}`);
    if (response.status === 204) return null;
    return await response.json();
  }

  private ensureWebSocket() {
    if (this.ws) return;
    if (this.runningJudge.size === 0) return;
    if (this.stopped) return;

    const CHANNEL_JUDGE_RESULT = "judge.result";

    this.ws = new WebSocket(this.LUOGU_OPENAPI_WEBSOCKET + `?token=${this.token}&channel=judge.result`);
    this.ws.onclose = e => {
      console.error("WebSocket disconnected:", e.reason);
      this.ws = null;
      this.ensureWebSocket();
    };
    this.ws.onerror = e => {
      console.error("WebSocket error:", e.error);
      this.ws = null;
      this.ws.close();
    };
    this.ws.onmessage = e => {
      const [channel, message] = String(e.data).split("\x00");
      if (channel === CHANNEL_JUDGE_RESULT) {
        const result = JSON.parse(message) as HttpGetJudgeResultResponse;
        if (result.type === "judge") {
          this.processJudgeResult(result.trackId, result.data);
        }
      }
    };
  }

  private async pollJudgeResult() {
    this.pollResultTimer = null;
    await Promise.all(Array.from(this.runningJudge.keys()).map(async trackId => {
      const judge = this.runningJudge.get(trackId);
      if (!judge) return;
      if (Date.now() - judge.lastUpdateTime < this.POLL_RESULT_MIN_HANG_TIME) return;

      try {
        const result = await this.call<void, HttpGetJudgeResultResponse>("GET", "/judge/result?id=" + judge.requestId);
        if (result && result.type === "judge") {
          this.processJudgeResult(result.trackId, result.data);
        }
      } catch (e) {
        console.log(e);
      }
    }));

    if (!this.stopped) {
      this.pollResultTimer = setTimeout(() => this.pollJudgeResult(), this.POLL_RESULT_INTERVAL);
    }
  }

  private processJudgeResult(trackId: string, data: JudgeRecord) {
    const status = this.runningJudge.get(trackId);
    if (!status) return;
    this.onJudgeProgress(trackId, data);
    if ((data.compile && !data.compile.success) || (data.judge && ![JudgeStatus.Waiting, JudgeStatus.Judging].includes(data.judge.status))) {
      this.runningJudge.delete(trackId);
      console.log("judge finish", trackId);
      return;
    }
    status.lastUpdateTime = Date.now();
  }

  async submit(request: JudgeRequest) {
    const trackId = uuid();
    const { requestId } = await this.call<HttpSubmitJudgeRequest, { requestId: string }>("POST", "/judge/problem", {
      ...request,
      trackId
    });
    this.runningJudge.set(trackId, {
      requestId,
      lastUpdateTime: Date.now()
    });
    this.ensureWebSocket();
  }

  stop() {
    this.stopped = true;
    this.ws.close();
    if (this.pollResultTimer) clearTimeout(this.pollResultTimer);
  }
}
