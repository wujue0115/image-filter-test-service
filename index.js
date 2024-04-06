// import "dotenv/config";
import express from "express";
import cors from "cors";

import remini from "./routes/remini.js";

const app = express();

app.use(cors({}));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.use("/api", remini);

app.listen(process.env.PORT || 4000, async () => {
  console.log("伺服器啟動");
});
