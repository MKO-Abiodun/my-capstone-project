export class WaitlistQueue {
  #head = null;
  #tail = null;
  #size = 0;

  enqueue(value) {
    const node = { value, next: null };
    if (this.#tail) {
      this.#tail.next = node;
    } else {
      this.#head = node;
    }
    this.#tail = node;
    this.#size++;
  }

  dequeue() {
    if (!this.#head) return null;
    const value = this.#head.value;
    this.#head = this.#head.next;
    this.#size--;
    if (!this.#head) this.#tail = null;
    return value;
  }

  peek() {
    return this.#head?.value ?? null;
  }

  get size() {
    return this.#size;
  }
}

export const Queue = WaitlistQueue;
