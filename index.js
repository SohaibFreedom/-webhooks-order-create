import express from "express";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

app.post("/webhooks/order-create", (req, res) => {
  console.log("Order Created");
  console.log(req.body);
  res.status(200).send("OK");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});
