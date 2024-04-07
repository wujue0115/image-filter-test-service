import fs from "fs/promises";
import crypto from "crypto";
import axios from "axios";

import { Router } from "express";
import multer from "multer";
import "dotenv/config";

const router = Router();

const upload = multer({ dest: "uploads/" });

const API_KEY = process.env.REMINI_API_KEY;
const CONTENT_TYPE = "image/jpeg";
const OUTPUT_CONTENT_TYPE = "image/jpeg";

const TIMEOUT = 60000;
const BASE_URL = "https://developer.remini.ai/api";

async function getImageMd5Content(imageFile) {
  const content = await fs.readFile(imageFile.path);
  const md5Hash = crypto.createHash("md5").update(content).digest("base64");
  return { md5Hash, content };
}

async function main(imageFile) {
  const { md5Hash, content } = await getImageMd5Content(imageFile);

  const client = axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${API_KEY}` },
    timeout: TIMEOUT,
  });

  console.log("Submitting image ...");
  const submitTaskResponse = await client.post("/tasks", {
    tools: [
      { type: "face_enhance", mode: "beautify" },
      { type: "color_enhance", mode: "new-york" },
    ],
    image_md5: md5Hash,
    image_content_type: CONTENT_TYPE,
    output_content_type: OUTPUT_CONTENT_TYPE,
  });

  const taskID = submitTaskResponse.data.task_id;
  const uploadURL = submitTaskResponse.data.upload_url;
  const uploadHeaders = submitTaskResponse.data.upload_headers;

  console.log("Uploading image to Google Cloud Storage ...");
  await axios.put(uploadURL, content, { headers: uploadHeaders });

  console.log(`Processing task: ${taskID} ...`);
  await client.post(`/tasks/${taskID}/process`);

  console.log(`Polling result for task: ${taskID} ...`);
  for (let i = 0; i < 50; i++) {
    const getTaskResponse = await client.get(`/tasks/${taskID}`);

    if (getTaskResponse.data.status === "completed") {
      console.log("Processing completed.");
      console.log("Output url: " + getTaskResponse.data.result.output_url);
      return {
        outputURL: getTaskResponse.data.result.output_url,
      };
    } else {
      if (getTaskResponse.data.status !== "processing") {
        console.error("Found illegal status: " + getTaskResponse.data.status);
        return { error: "Illegal status: " + getTaskResponse.data.status };
      }
      console.log("Processing, sleeping 2 seconds ...");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.error("Timeout reached! :( ");
}

router.post("/filter", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  const response = await main(req.file);
  return res.status(200).send(response);
});

router.post("/hello", (req, res) => {
  res.send("Hello World");
});

export default router;
