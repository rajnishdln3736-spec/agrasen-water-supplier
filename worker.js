/**
 * Agrasen Water Supplier - Full Stack Cloudflare Worker Backend
 * Provides:
 *  - GET /                 -> Customer Facing Web Portal
 *  - GET /admin            -> Secure Admin Dashboard / Login
 *  - GET /api/products     -> Public Product Catalog & Dynamic Pricing API
 *  - POST /api/admin/login -> Secure Admin Authentication
 *  - PUT /api/admin/products/:id -> Authenticated Price Update with Validation
 *  - POST /api/admin/logout -> Session Invalidation
 */

// Initial Seed Database
const DEFAULT_PRODUCTS = {
  p1: {
    id: "p1",
    name: "1 Litre Bottle Pack (12 Pcs)",
    price: 240,
    pack_size: "12 Bottles",
    unit: "carton",
    updated_at: new Date().toISOString()
  },
  p2: {
    id: "p2",
    name: "500ml Mini Pack (24 Pcs)",
    price: 280,
    pack_size: "24 Bottles",
    unit: "carton",
    updated_at: new Date().toISOString()
  },
  p3: {
    id: "p3",
    name: "250ml Pocket Bottles (30 Pcs)",
    price: 210,
    pack_size: "30 Bottles",
    unit: "carton",
    updated_at: new Date().toISOString()
  }
};

// In-Memory Storage & KV Bridge
let globalProductsState = { ...DEFAULT_PRODUCTS };
const activeSessions = new Set();

// Admin Credentials Configuration (Server-Side Verification)
const ADMIN_USERNAME = "admin@agrasenwater.com";
const ADMIN_ALT_USER = "satish";
// SHA-256 hash of initial password 'Agrasen@2026'
const ADMIN_PASSWORD_HASH = "8f3cf58bb0e0ba6fc7db8489ca7b520c184061a55963f45f7c32bf28b61cbb88"; 

// Helper: Compute SHA-256 Hash
async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// Helper: Generate Cryptographic Session Token
function generateSessionToken() {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, "0")).join("");
}

// Helper: Verify Bearer Auth Token
function verifyAuth(request) {
  const authHeader = request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return false;
  const token = authHeader.substring(7).trim();
  return activeSessions.has(token);
}

// CORS Headers Helper
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

// Load Products from Storage (KV or In-Memory)
async function getStoredProducts(env) {
  if (env && env.PRODUCTS_KV) {
    try {
      const stored = await env.PRODUCTS_KV.get("products", { type: "json" });
      if (stored) return stored;
    } catch (e) {}
  }
  return globalProductsState;
}

// Save Products to Storage (KV & In-Memory)
async function saveStoredProducts(env, products) {
  globalProductsState = { ...products };
  if (env && env.PRODUCTS_KV) {
    try {
      await env.PRODUCTS_KV.put("products", JSON.stringify(products));
    } catch (e) {}
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "") || "/";
    const method = request.method.toUpperCase();

    // Handle OPTIONS Preflight
    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    // 1. PUBLIC API: GET /api/products
    if (path === "/api/products" && method === "GET") {
      const products = await getStoredProducts(env);
      return new Response(JSON.stringify({ success: true, products }), {
        headers: { "Content-Type": "application/json", ...corsHeaders() }
      });
    }

    // 2. PUBLIC API: GET /api/products/:id
    if (path.startsWith("/api/products/") && method === "GET") {
      const id = path.split("/")[3];
      const products = await getStoredProducts(env);
      if (!products[id]) {
        return new Response(JSON.stringify({ success: false, error: "Product not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders() }
        });
      }
      return new Response(JSON.stringify({ success: true, product: products[id] }), {
        headers: { "Content-Type": "application/json", ...corsHeaders() }
      });
    }

    // 3. ADMIN API: POST /api/admin/login
    if (path === "/api/admin/login" && method === "POST") {
      try {
        const body = await request.json();
        const { username, password } = body;

        const isUserMatch = username && (
          username.toLowerCase() === ADMIN_USERNAME.toLowerCase() || 
          username.toLowerCase() === ADMIN_ALT_USER.toLowerCase()
        );

        if (!isUserMatch || !password) {
          return new Response(JSON.stringify({ success: false, error: "Invalid username or password" }), {
            status: 401,
            headers: { "Content-Type": "application/json", ...corsHeaders() }
          });
        }

        const passHash = await sha256(password);
        // Also support plain initial password match for safety fallback
        const isPassMatch = passHash === ADMIN_PASSWORD_HASH || password === "Agrasen@2026";

        if (!isPassMatch) {
          return new Response(JSON.stringify({ success: false, error: "Invalid username or password" }), {
            status: 401,
            headers: { "Content-Type": "application/json", ...corsHeaders() }
          });
        }

        const sessionToken = generateSessionToken();
        activeSessions.add(sessionToken);

        const products = await getStoredProducts(env);
        return new Response(JSON.stringify({
          success: true,
          token: sessionToken,
          message: "Login successful",
          products
        }), {
          headers: { "Content-Type": "application/json", ...corsHeaders() }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: "Invalid request payload" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders() }
        });
      }
    }

    // 4. ADMIN API: POST /api/admin/logout
    if (path === "/api/admin/logout" && method === "POST") {
      const authHeader = request.headers.get("Authorization") || "";
      if (authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7).trim();
        activeSessions.delete(token);
      }
      return new Response(JSON.stringify({ success: true, message: "Logged out" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders() }
      });
    }

    // 5. ADMIN API: PUT /api/admin/products/:id (Update Product Price)
    if (path.startsWith("/api/admin/products/") && (method === "PUT" || method === "POST")) {
      if (!verifyAuth(request)) {
        return new Response(JSON.stringify({ success: false, error: "Unauthorized: Invalid or expired admin session" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders() }
        });
      }

      const id = path.split("/")[4];
      const products = await getStoredProducts(env);

      if (!products[id]) {
        return new Response(JSON.stringify({ success: false, error: "Product not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders() }
        });
      }

      try {
        const body = await request.json();
        const priceNum = parseFloat(body.price);

        // Security & Numerical Validation
        if (isNaN(priceNum) || priceNum <= 0) {
          return new Response(JSON.stringify({ success: false, error: "Price must be a valid numeric value greater than 0" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders() }
          });
        }

        // Update product record
        products[id].price = Math.round(priceNum * 100) / 100;
        products[id].updated_at = new Date().toISOString();

        await saveStoredProducts(env, products);

        return new Response(JSON.stringify({
          success: true,
          message: "Price updated successfully.",
          product: products[id]
        }), {
          headers: { "Content-Type": "application/json", ...corsHeaders() }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: "Failed to parse price update request" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders() }
        });
      }
    }

    // 6. ROUTE: /admin -> Render Admin UI
    if (path === "/admin") {
      return new Response(ADMIN_HTML_CONTENT, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // 7. ROUTE: / -> Render Customer Frontend
    if (path === "/" || path === "/index.html") {
      return new Response(CUSTOMER_HTML_CONTENT, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // Fallback: 404 Not Found
    return new Response("Not Found", { status: 404 });
  }
};

// HTML Bundled Templates will be injected below for full-stack portability
