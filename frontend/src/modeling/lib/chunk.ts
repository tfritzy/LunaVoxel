import { Counter } from "@/wasm/vector3_wasm";

export class Chunk {
  private counter: Counter;

  public constructor() {
    // Initialize counter with value 10
    this.counter = new Counter(10);
    console.log(
      "Chunk initialized with counter value:",
      this.counter.getValue()
    );

    // Test increment
    this.counter.increment();
    console.log("After increment:", this.counter.getValue());

    // Test custom step size
    this.counter.setStepSize(5);
    this.counter.increment();
    console.log("After increment with step size 5:", this.counter.getValue());

    // Test add
    this.counter.add(3);
    console.log("After adding 3:", this.counter.getValue());

    // Test multiply
    this.counter.multiply(2);
    console.log("After multiplying by 2:", this.counter.getValue());

    // Test decrement
    this.counter.decrement();
    console.log("After decrement:", this.counter.getValue());

    // Test reset
    this.counter.reset();
    console.log("After reset:", this.counter.getValue());
  }
}
