import "./style.css";
import { TabManager } from "./terminal/TabManager";

const app = document.getElementById("app");
if (!app) throw new Error("#app not found");

const manager = new TabManager(app);
await manager.newTab();
