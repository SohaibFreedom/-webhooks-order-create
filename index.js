import express from "express";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

const TARGET_PRODUCT_ID = Number(process.env.TARGET_PRODUCT_ID);
const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

// --------------------
// Helpers
// --------------------
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function shopifyFetch(body) {
  const res = await fetch(
    `https://${SHOPIFY_STORE}/admin/api/2024-10/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_TOKEN
      },
      body: JSON.stringify(body)
    }
  );

  const json = await res.json();

  if (json.errors) {
    console.error("❌ Shopify GraphQL errors:", json.errors);
  }

  return json;
}

// --------------------
// Webhook
// --------------------
app.post("/order-create", async (req, res) => {
  const order = req.body;

  console.log("====================================");
  console.log("✅ Order Created:", order.id);
  console.log("📧 Order email:", order.email);
  console.log("👤 Order customer object:", order.customer);
  console.log("🧾 Line items:", order.line_items?.map(i => i.product_id));
  console.log("====================================");

  // Shopify requires immediate 200
  res.status(200).send("OK");

  try {
    // 1️⃣ Check target product
    const hasTargetProduct = order.line_items?.some(
      item => item.product_id === TARGET_PRODUCT_ID
    );

    if (!hasTargetProduct) {
      console.log("⏭ Target product NOT found → stopping");
      return;
    }

    // 2️⃣ Email is mandatory
    const customerEmail = order.email;
    if (!customerEmail) {
      console.log("❌ No email on order → cannot proceed");
      return;
    }

    // 3️⃣ Retry logic (race condition fix)
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`⏳ Attempt ${attempt}/3 → waiting 20s`);
      await delay(20000);

      // 4️⃣ Find customer by email
      const findCustomerRes = await shopifyFetch({
        query: `
          query ($query: String!) {
            customers(first: 1, query: $query) {
              edges {
                node {
                  id
                  email
                  state
                }
              }
            }
          }
        `,
        variables: {
          query: `email:${customerEmail}`
        }
      });

      const customer =
        findCustomerRes?.data?.customers?.edges?.[0]?.node || null;

      if (!customer) {
        console.log("⚠️ Customer NOT found yet");
        continue;
      }

      console.log("✅ Customer found:", customer.id);
      console.log("📌 Customer state:", customer.state);

      // 5️⃣ Already active → stop
      if (customer.state !== "DISABLED") {
        console.log("⏭ Customer already active → invite skipped");
        return;
      }

      // 6️⃣ Send account invite
      const inviteRes = await shopifyFetch({
        query: `
          mutation ($customerId: ID!) {
            customerSendAccountInviteEmail(customerId: $customerId) {
              customer { id }
              userErrors { message }
            }
          }
        `,
        variables: {
          customerId: customer.id
        }
      });

      const errors =
        inviteRes?.data?.customerSendAccountInviteEmail?.userErrors;

      if (errors && errors.length) {
        console.error("❌ Invite userErrors:", errors);
        return;
      }

      console.log("📧 Account invite SENT successfully");
      return;
    }

    console.log("❌ Customer still not available after all retries");

  } catch (err) {
    console.error("❌ Background processing error:", err);
  }
});

// --------------------
// Health Check
// --------------------
app.get("/order-create", (req, res) => res.status(200).send("OK"));

// --------------------
app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Server running");
});
