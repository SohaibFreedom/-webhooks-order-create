
import express from "express";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

const TARGET_PRODUCT_ID = process.env.TARGET_PRODUCT_ID;
const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

// --- Order Create Webhook ---
app.post("/order-create", async (req, res) => {
  try {
    const order = req.body;

    console.log("✅ Order Created:", order.id);

    // 1️⃣ Check if target product exists in order
    const hasTargetProduct = order.line_items?.some(
      item => item.product_id === TARGET_PRODUCT_ID
    );

    if (!hasTargetProduct) {
      console.log("⏭ Target product not found. Skipping.");
      return res.status(200).send("OK");
    }

    // 2️⃣ Get customer ID
    const customerId = order.customer?.id;

    if (!customerId) {
      console.log("⚠️ Order has target product but NO customer");
      return res.status(200).send("OK");
    }

    const customerGid = `gid://shopify/Customer/${customerId}`;

    // 3️⃣ Call Shopify GraphQL mutation
    const response = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2025-10/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": SHOPIFY_TOKEN
        },
        body: JSON.stringify({
          query: `
            mutation customerGenerateAccountActivationUrl($customerId: ID!) {
              customerGenerateAccountActivationUrl(customerId: $customerId) {
                accountActivationUrl
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          variables: {
            customerId: customerGid
          }
        })
      }
    );

    const result = await response.json();

    console.log("✅ Activation URL response:", result);

    return res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Webhook error:", err);
    return res.status(200).send("OK"); // Shopify requires 200
  }
});

// Health check
app.get("/order-create", (req, res) => res.status(200).send("OK"));

app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Server running");
});

