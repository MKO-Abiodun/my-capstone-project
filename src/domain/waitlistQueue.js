export class WaitlistQueue {
  #head = 0;
  #tail = 0;
  #items = {};
  enqueue(item) { this.#items[this.#tail] = item; this.#tail++; }
  dequeue() {
    if (this.size === 0) return null;
    const item = this.#items[this.#head];
    delete this.#items[this.#head];
    this.#head++;
    return item;
  }
  peek() {
    if (this.size === 0) return null;
    return this.#items[this.#head];
  }
  get size() { return this.#tail - this.#head; }
}
