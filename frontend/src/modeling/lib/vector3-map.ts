interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface Vector3Entry<T> {
  vector: Vector3;
  value: T;
}

export class Vector3Map<T> {
  private map: Map<number, Vector3Entry<T>[]>;
  private _size: number;

  constructor() {
    this.map = new Map();
    this._size = 0;
  }

  /**
   * Creates a hash from Vector3 coordinates
   * Uses a simple but effective hash combining x, y, z coordinates
   */
  private hash(vector: Vector3): number {
    // Use bit shifting and prime numbers for better distribution
    const x = Math.floor(vector.x * 1000); // Handle decimals
    const y = Math.floor(vector.y * 1000);
    const z = Math.floor(vector.z * 1000);

    // Simple hash combining coordinates with prime multipliers
    return ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0;
  }

  /**
   * Checks if two Vector3 objects are equal
   */
  private vectorEquals(a: Vector3, b: Vector3): boolean {
    return a.x === b.x && a.y === b.y && a.z === b.z;
  }

  /**
   * Sets a value for the given Vector3 key
   */
  set(vector: Vector3, value: T): this {
    const hashCode = this.hash(vector);
    const bucket = this.map.get(hashCode);

    if (!bucket) {
      // No collision, create new bucket
      this.map.set(hashCode, [{ vector, value }]);
      this._size++;
    } else {
      // Check for existing key in bucket
      const existingIndex = bucket.findIndex((entry) =>
        this.vectorEquals(entry.vector, vector)
      );

      if (existingIndex >= 0) {
        // Update existing entry
        bucket[existingIndex].value = value;
      } else {
        // Add new entry to bucket (collision handling)
        bucket.push({ vector, value });
        this._size++;
      }
    }

    return this;
  }

  /**
   * Gets a value for the given Vector3 key
   */
  get(vector: Vector3): T | undefined {
    const hashCode = this.hash(vector);
    const bucket = this.map.get(hashCode);

    if (!bucket) {
      return undefined;
    }

    const entry = bucket.find((entry) =>
      this.vectorEquals(entry.vector, vector)
    );

    return entry?.value;
  }

  /**
   * Checks if the map contains the given Vector3 key
   */
  has(vector: Vector3): boolean {
    const hashCode = this.hash(vector);
    const bucket = this.map.get(hashCode);

    if (!bucket) {
      return false;
    }

    return bucket.some((entry) => this.vectorEquals(entry.vector, vector));
  }

  /**
   * Deletes the entry for the given Vector3 key
   */
  delete(vector: Vector3): boolean {
    const hashCode = this.hash(vector);
    const bucket = this.map.get(hashCode);

    if (!bucket) {
      return false;
    }

    const entryIndex = bucket.findIndex((entry) =>
      this.vectorEquals(entry.vector, vector)
    );

    if (entryIndex >= 0) {
      bucket.splice(entryIndex, 1);
      this._size--;

      // Remove empty bucket
      if (bucket.length === 0) {
        this.map.delete(hashCode);
      }

      return true;
    }

    return false;
  }

  /**
   * Clears all entries from the map
   */
  clear(): void {
    this.map.clear();
    this._size = 0;
  }

  /**
   * Returns the number of entries in the map
   */
  get size(): number {
    return this._size;
  }

  /**
   * Returns an iterator for all Vector3 keys
   */
  *keys(): IterableIterator<Vector3> {
    for (const bucket of this.map.values()) {
      for (const entry of bucket) {
        yield entry.vector;
      }
    }
  }

  /**
   * Returns an iterator for all values
   */
  *values(): IterableIterator<T> {
    for (const bucket of this.map.values()) {
      for (const entry of bucket) {
        yield entry.value;
      }
    }
  }

  /**
   * Returns an iterator for all [Vector3, value] pairs
   */
  *entries(): IterableIterator<[Vector3, T]> {
    for (const bucket of this.map.values()) {
      for (const entry of bucket) {
        yield [entry.vector, entry.value];
      }
    }
  }

  /**
   * Executes a callback for each entry in the map
   */
  forEach(
    callback: (value: T, vector: Vector3, map: Vector3Map<T>) => void
  ): void {
    for (const [vector, value] of this.entries()) {
      callback(value, vector, this);
    }
  }

  /**
   * Makes the map iterable with for...of loops
   */
  [Symbol.iterator](): IterableIterator<[Vector3, T]> {
    return this.entries();
  }
}
