const fs = require("fs");
const p =
  "c:/Users/naman/Desktop/Project PineWire/Project-PineWire/frontend/src/App.css";
const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
let cum = 0;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  const opens = (l.match(/\{/g) || []).length;
  const closes = (l.match(/\}/g) || []).length;
  cum += opens - closes;
  if (i >= 700 && i <= 920)
    console.log(
      (" " + (i + 1)).slice(-4) + " cum:" + ("  " + cum).slice(-3) + " | " + l,
    );
}
