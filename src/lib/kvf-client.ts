import { config } from "./config";
import type { FetchResult, KvfClient } from "./types";
import { absoluteUrl } from "./utils";

class Semaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active += 1;
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.queue.push(() => {
        this.active += 1;
        resolve();
      });
    });
  }

  private release(): void {
    this.active -= 1;
    const next = this.queue.shift();
    next?.();
  }
}

export class HttpKvfClient implements KvfClient {
  private readonly semaphore = new Semaphore(config.maxConcurrency);

  async fetchHtml(url: string): Promise<FetchResult> {
    return this.semaphore.run(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

      try {
        const response = await fetch(absoluteUrl(url), {
          headers: {
            "user-agent": config.userAgent,
            accept: "text/html,application/xhtml+xml"
          },
          redirect: "follow",
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`KVF request failed with status ${response.status} for ${url}`);
        }

        return {
          url: response.url,
          html: await response.text()
        };
      } finally {
        clearTimeout(timeout);
      }
    });
  }
}
