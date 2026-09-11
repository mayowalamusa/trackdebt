import { JSDOM } from "jsdom";

const storageWindow = new JSDOM("", { url: "http://localhost" }).window;

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: storageWindow.localStorage,
});
Object.defineProperty(globalThis, "Storage", {
  configurable: true,
  value: storageWindow.Storage,
});