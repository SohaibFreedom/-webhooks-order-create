import express from "express";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

const TARGET_PRODUCT_ID = Number(process.env.TARGET_PRODUCT_ID);
const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

// --- Order Create Webhook ---
app.post("/order-create", async (req, res) => {
  try {
    const order = req.body;
    console.log("✅ Order Created:", order.id);

    // 1️⃣ Check target product
    const hasTargetProduct = order.line_items?.some(
      item => item.product_id === TARGET_PRODUCT_ID
    );

    if (!hasTargetProduct) {
      console.log("⏭ Target product not found. Skipping.");
      return res.status(200).send("OK");
    }

    // 2️⃣ Customer check
    const customerId = order.customer?.id;
    if (!customerId) {
      console.log("⚠️ No customer on order");
      return res.status(200).send("OK");
    }

    const customerGid = `gid://shopify/Customer/${customerId}`;

    // 3️⃣ Fetch customer state
    const customerStateRes = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2025-10/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": SHOPIFY_TOKEN
        },
        body: JSON.stringify({
          query: `
            query ($id: ID!) {
              customer(id: $id) {
                id
                state
                email
              }
            }
          `,
          variables: { id: customerGid }
        })
      }
    );

    const customerStateData = await customerStateRes.json();
    const customer = customerStateData?.data?.customer;

    if (!customer) {
      console.log("❌ Customer not found");
      return res.status(200).send("OK");
    }

    // 4️⃣ Only send invite if DISABLED
    if (customer.state !== "DISABLED") {
      console.log(`⏭ Customer already ${customer.state}. Invite skipped.`);
      return res.status(200).send("OK");
    }

    // 5️⃣ Send Shopify account invite email
    const inviteRes = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2025-10/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": SHOPIFY_TOKEN
        },
        body: JSON.stringify({
          query: `
            mutation CustomerSendAccountInviteEmail($customerId: ID!) {
              customerSendAccountInviteEmail(customerId: $customerId) {
                customer {
                  id
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          variables: { customerId: customerGid }
        })
      }
    );

    const inviteResult = await inviteRes.json();
    console.log("📧 Invite result:", inviteResult);

    return res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Webhook error:", err);
    return res.status(200).send("OK");
  }
});

// Health check
app.get("/order-create", (req, res) => res.status(200).send("OK"));

app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Server running");
});

