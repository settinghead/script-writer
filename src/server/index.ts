import express from "express";
import ViteExpress from "vite-express";
const PORT = parseInt(process.env.PORT || "4600");
const app = express();

app.get("/message", (_req, res) => {
  res.send("Hello from Express!");
});

ViteExpress.listen(app, PORT, () => {
  console.log(`Server is listening on http://localhost:${PORT}`);
});
