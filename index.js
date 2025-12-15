import express from "express";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

// ✅ Match Shopify webhook URL you are using:
app.post("/order-create", (req, res) => {
  console.log("✅ Order Created webhook hit");
  console.log(req.body);
  res.status(200).send("OK");
});

// (Optional) quick health check so browser doesn't show Cannot GET
app.get("/order-create", (req, res) => res.status(200).send("OK"));

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});

