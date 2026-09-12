/**
 * Agrasen Water Supplier - Interactive Cart & WhatsApp Order Engine
 * Built for Satish Agrawal (Purani Bazar, Ward No. 3, Chandauli)
 * Phone: +91 8604858581
 */

const WHATSAPP_NUMBER = "918604858581";

// Product Catalog Data
const products = {
  p1: { name: "20L Mineral Water Jar", price: 40, qty: 0, unit: "jar" },
  p2: { name: "1L Bottle Pack (12 Pcs)", price: 240, qty: 0, unit: "carton" },
  p3: { name: "500ml Mini Pack (24 Pcs)", price: 280, qty: 0, unit: "carton" },
  p4: { name: "250ml Event Pack (30 Pcs)", price: 210, qty: 0, unit: "carton" },
  p5: { name: "Jar Stand & Dispenser Tap", price: 180, qty: 0, unit: "unit" }
};

// Update product quantity (+ / -)
function updateQty(productId, change) {
  if (!products[productId]) return;

  let current = products[productId].qty;
  let updated = current + change;
  if (updated < 0) updated = 0;

  products[productId].qty = updated;
  
  const inputEl = document.getElementById(`qty-${productId}`);
  if (inputEl) {
    inputEl.value = updated;
  }

  renderOrderSummary();
}

// Render the live order summary
function renderOrderSummary() {
  const container = document.getElementById("selected-items-container");
  const totalAmountEl = document.getElementById("total-price");
  const countBadgeEl = document.getElementById("item-count-badge");

  let totalAmount = 0;
  let totalItemsCount = 0;
  let itemsHtml = "";

  for (const [id, item] of Object.entries(products)) {
    if (item.qty > 0) {
      const itemSubtotal = item.qty * item.price;
      totalAmount += itemSubtotal;
      totalItemsCount += item.qty;

      itemsHtml += `
        <div class="cart-item-row">
          <span>${item.name} <strong>× ${item.qty}</strong></span>
          <span>₹${itemSubtotal}</span>
        </div>
      `;
    }
  }

  if (totalItemsCount === 0) {
    container.innerHTML = `<p class="empty-hint"><i class="fa-solid fa-cart-arrow-down"></i> Upar diye gaye products me se <strong>(+)</strong> dabakar quantity chunein.</p>`;
    countBadgeEl.textContent = "0 Items Selected";
  } else {
    container.innerHTML = itemsHtml;
    countBadgeEl.textContent = `${totalItemsCount} Items Selected`;
  }

  totalAmountEl.textContent = `₹${totalAmount}`;
}

// Generate formatted WhatsApp message and open WhatsApp
function sendOrderWhatsApp() {
  let orderedItems = [];
  let totalAmount = 0;

  for (const [id, item] of Object.entries(products)) {
    if (item.qty > 0) {
      const subtotal = item.qty * item.price;
      totalAmount += subtotal;
      orderedItems.push(`• *${item.name}* : ${item.qty} ${item.unit} (₹${subtotal})`);
    }
  }

  if (orderedItems.length === 0) {
    alert("Kripya pehle upar se kam se kam 1 product ki quantity (+) select karein.");
    document.getElementById("products").scrollIntoView({ behavior: 'smooth' });
    return;
  }

  const custName = document.getElementById("cust-name").value.trim() || "Customer";
  const custAddress = document.getElementById("cust-address").value.trim() || "Chandauli (Purani Bazar)";
  const deliveryTime = document.getElementById("delivery-time").value;

  // Formatted WhatsApp Order Slip
  const message = 
`📦 *NEW WATER ORDER - AGRASEN WATER SUPPLIER*
━━━━━━━━━━━━━━━━━━━━
👤 *Customer Name:* ${custName}
📍 *Delivery Address:* ${custAddress}
⏰ *Delivery Time:* ${deliveryTime}
━━━━━━━━━━━━━━━━━━━━
🛒 *ORDER ITEMS:*
${orderedItems.join("\n")}
━━━━━━━━━━━━━━━━━━━━
💰 *ESTIMATED TOTAL: ₹${totalAmount}*
🚚 *Location:* Chandauli (Purani Bazar, Ward No. 3)

_Kripya order confirm karke delivery bhej dijiye._`;

  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, "_blank");
}

// Share Agency Page
function shareAgencyPage() {
  if (navigator.share) {
    navigator.share({
      title: "Agrasen Water Supplier - Chandauli",
      text: "Order Pure 20L Mineral Water Jars & Bottles in Chandauli from Satish Agrawal (Agrasen Water Supplier).",
      url: window.location.href
    }).catch(() => {});
  } else {
    // Fallback: Copy link to clipboard
    navigator.clipboard.writeText(window.location.href).then(() => {
      alert("✅ Website Link Copied! Aap ise WhatsApp ya Instagram par share kar sakte hain.");
    }).catch(() => {
      alert("Website Link: " + window.location.href);
    });
  }
}

// Download Satish Agrawal vCard (.vcf) directly into phone contacts
function downloadContactVCard() {
  const vcard = 
`BEGIN:VCARD
VERSION:3.0
FN:Satish Agrawal (Agrasen Water Supplier)
ORG:Agrasen Water Supplier Chandauli
TITLE:Proprietor & Mineral Water Distributor
TEL;TYPE=CELL,VOICE:+918604858581
ADR;TYPE=WORK:;;Purani Bazar, Ward No. 3;Chandauli;UP;;India
NOTE:20L Water Jars, Mineral Water Bottles & Wedding Bulk Supply in Chandauli.
END:VCARD`;

  const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Satish_Agrawal_Agrasen_Water.vcf";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
