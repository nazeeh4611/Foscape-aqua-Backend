import Order from '../Model/OrderModel.js';
import Cart from '../Model/CartModel.js';
import Product from '../Model/ProductModel.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import sendEmail from "../Utils/SendMail.js";
import UserModel from '../Model/UserModel.js';
import PDFDocument from "pdfkit";

console.log(process.env.RAZORPAY_KEY_ID,process.env.RAZORPAY_KEY_SECRET)
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const generateOrderNumber = () => {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD${timestamp}${random}`;
};

export const createRazorpayOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { amount } = req.body;

    const options = {
      amount: amount * 100,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
    };

    const razorpayOrder = await razorpay.orders.create(options);

    res.status(200).json({
      success: true,
      order: razorpayOrder,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating payment order',
      error: error.message,
    });
  }
};

export const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest('hex');

    if (razorpay_signature === expectedSign) {
      res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid signature',
      });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying payment',
      error: error.message,
    });
  }
};

export const createOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { shippingAddress, paymentMethod, paymentDetails } = req.body;

    const cart = await Cart.findOne({ user: userId }).populate('items.product');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty',
      });
    }

    for (const item of cart.items) {
      if (!item.product) {
        return res.status(400).json({
          success: false,
          message: 'Some products in cart are no longer available',
        });
      }

      if (item.product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${item.product.name}`,
        });
      }
    }

    const orderItems = cart.items.map((item) => ({
      product: item.product._id,
      quantity: item.quantity,
      price: item.price,
      name: item.product.name,
      image: item.product.images?.[0] || '',
    }));

    const totalAmount = cart.totalAmount;

    const orderData = {
      user: userId,
      orderNumber: generateOrderNumber(),
      items: orderItems,
      shippingAddress,
      paymentMethod,
      totalAmount,
      paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Paid',
      orderStatus: 'Pending',
    };

    if (paymentMethod === 'Razorpay' && paymentDetails) {
      orderData.paymentDetails = paymentDetails;
    }

    const order = await Order.create(orderData);

    for (const item of cart.items) {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { stock: -item.quantity },
      });
    }

    cart.items = [];
    await cart.save();

    const populatedOrder = await Order.findById(order._id).populate('items.product');

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order: populatedOrder,
    });
    const user = await UserModel.findById(userId);

    const emailSubject = "Your Order Has Been Placed!";
    const emailMessage = orderSuccessEmail(user, populatedOrder);

await sendEmail(user.email, emailSubject, emailMessage);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating order',
      error: error.message,
    });
  }
};

export const getUserOrders = async (req, res) => {
  try {
    const userId = req.user._id;

    const orders = await Order.find({ user: userId })
      .populate('items.product')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching orders',
      error: error.message,
    });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const userId = req.user._id;
    const { orderId } = req.params;

    const order = await Order.findOne({ _id: orderId, user: userId }).populate('items.product');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching order',
      error: error.message,
    });
  }
};

export const cancelOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await Order.findOne({ _id: orderId, user: userId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (!['Pending', 'Confirmed'].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage',
      });
    }

    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity },
      });
    }

    order.orderStatus = 'Cancelled';
    order.cancelReason = reason || 'Cancelled by user';
    order.statusHistory.push({
      status: 'Cancelled',
      timestamp: new Date(),
      note: reason || 'Cancelled by user',
    });

    await order.save();

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      order,
    });
    const user = await UserModel.findById(userId);

    const emailSubject = "Your Order Has Been Cancelled";
    const emailMessage = orderCancelledEmail(user, order);

    await sendEmail(user.email, emailSubject, emailMessage);

  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling order',
      error: error.message,
    });
  }
};


const orderSuccessEmail = (user, order) => `
<div style="
  font-family: Arial, sans-serif;
  max-width: 600px;
  margin: 0 auto;
  background: #F0FAF8;
  padding: 30px;
  border-radius: 16px;
  border: 1px solid #e0f2ef;
">

  <!-- Header -->
  <div style="
    background: linear-gradient(to right, #144E8C, #78CDD1);
    padding: 25px;
    border-radius: 12px;
    text-align: center;
    color: white;
  ">
    <h2 style="margin: 0; font-size: 24px; font-weight: 700;">
      Order Placed Successfully!
    </h2>
    <p style="color: #e8f7f5; margin-top: 6px; font-size: 14px;">
      Thank you for shopping with Foscape
    </p>
  </div>

  <!-- Body -->
  <div style="padding: 25px; color: #333;">
    <p style="font-size: 15px;">Hello <strong>${user.name}</strong>,</p>

    <p style="font-size: 15px;">
      Your order <strong>${order.orderNumber}</strong> has been placed successfully.
    </p>

    <!-- Order Summary -->
    <div style="margin: 20px 0; padding: 20px; background: white; border-radius: 12px; box-shadow: 0 6px 14px rgba(20, 78, 140, 0.10);">
      <h3 style="margin: 0 0 12px; color: #144E8C;">Order Summary</h3>
      ${order.items
        .map(
          (item) => `
        <div style="padding: 8px 0; border-bottom: 1px solid #eee;">
          <strong>${item.name}</strong> × ${item.quantity}
          <div style="font-size: 13px; color: #666;">₹${item.price}</div>
        </div>`
        )
        .join("")}
      <p style="margin-top: 15px; font-size: 16px;">
        <strong>Total: ₹${order.totalAmount}</strong>
      </p>
    </div>

    <p style="font-size: 14px; margin-top: 20px; color: #144E8C; font-weight: 600;">
      Best regards,<br/>
      <span style="color: #333; font-weight: 500;">Foscape Team</span>
    </p>
  </div>
</div>
`;


const orderCancelledEmail = (user, order) => `
<div style="
  font-family: Arial, sans-serif;
  max-width: 600px;
  margin: 0 auto;
  background: #F0FAF8;
  padding: 30px;
  border-radius: 16px;
  border: 1px solid #e0f2ef;
">

  <!-- Header -->
  <div style="
    background: linear-gradient(to right, #144E8C, #78CDD1);
    padding: 25px;
    border-radius: 12px;
    text-align: center;
    color: white;
  ">
    <h2 style="margin: 0; font-size: 24px; font-weight: 700;">
      Order Cancelled
    </h2>
    <p style="color: #e8f7f5; margin-top: 6px; font-size: 14px;">
      Your order has been cancelled successfully
    </p>
  </div>

  <div style="padding: 25px; color: #333;">
    <p style="font-size: 15px;">Hello <strong>${user.name}</strong>,</p>

    <p style="font-size: 15px;">
      Your order <strong>${order.orderNumber}</strong> has been cancelled.
    </p>

    <p style="font-size: 15px; margin-top: 10px;">
      <strong>Cancellation Reason:</strong><br>
      ${order.cancelReason}
    </p>

    <div style="margin-top: 25px;">
      <p style="font-size: 14px; color: #144E8C; font-weight: 600;">
        Best regards,<br/>
        <span style="color: #333; font-weight: 500;">Foscape Team</span>
      </p>
    </div>
  </div>
</div>
`;




export const generateInvoice = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.orderStatus !== "Delivered") {
      return res
        .status(400)
        .json({ message: "Invoice only available for delivered orders" });
    }

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice-${order.orderNumber}.pdf`
    );

    doc.pipe(res);

    doc.fontSize(20).text("INVOICE", { align: "right" });
    doc.fontSize(10).text(`Order #${order.orderNumber}`, { align: "right" });
    doc.moveDown();

    doc.fontSize(12).text("FOSCAPE", 50, 50);
    doc.fontSize(10).text("4/46B, Juma Masjid, PV Building", 50, 70);
    doc.text("V Hamza Road, Near Naduvilangadi", 50, 85);
    doc.text("Tirur, Kerala 676107", 50, 100);
    doc.text("Phone: +91-854 748 3891", 50, 115);
    doc.text("Email: info@thefoscape.com", 50, 130);

    doc.moveTo(50, 160).lineTo(550, 160).stroke();

    // Bill To
    doc.fontSize(12).text("Bill To:", 50, 180);
    doc.fontSize(10).text(order.shippingAddress.fullName, 50, 200);
    doc.text(order.shippingAddress.phone, 50, 215);
    doc.text(order.shippingAddress.addressLine1, 50, 230);

    if (order.shippingAddress.addressLine2) {
      doc.text(order.shippingAddress.addressLine2, 50, 245);
      doc.text(
        `${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}`,
        50,
        260
      );
    } else {
      doc.text(
        `${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}`,
        50,
        245
      );
    }

    const invoiceY = 180;
    doc.fontSize(12).text("Invoice Details:", 350, invoiceY);
    doc
      .fontSize(10)
      .text(
        `Order Date: ${new Date(order.createdAt).toLocaleDateString("en-IN")}`,
        350,
        invoiceY + 20
      );

    doc.text(
      `Invoice Date: ${new Date().toLocaleDateString("en-IN")}`,
      350,
      invoiceY + 35
    );
    doc.text(`Status: ${order.orderStatus}`, 350, invoiceY + 50);

    if (order.paymentDetails?.razorpayPaymentId) {
      doc.text(
        `Transaction ID: ${order.paymentDetails.razorpayPaymentId}`,
        350,
        invoiceY + 65
      );
    }

    // Table
    const tableTop = 320;
    doc.moveTo(50, tableTop).lineTo(550, tableTop).stroke();

    doc.fontSize(10).text("Item", 50, tableTop + 10);
    doc.text("Quantity", 300, tableTop + 10, { width: 80, align: "center" });
    doc.text("Price", 380, tableTop + 10, { width: 80, align: "right" });
    doc.text("Amount", 460, tableTop + 10, { width: 90, align: "right" });

    doc.moveTo(50, tableTop + 30).lineTo(550, tableTop + 30).stroke();

    let yPosition = tableTop + 40;

    order.items.forEach((item) => {
      doc.text(item.name, 50, yPosition, { width: 240 });
      doc.text(item.quantity.toString(), 300, yPosition, {
        width: 80,
        align: "center",
      });
      doc.text(`₹${item.price}`, 380, yPosition, { width: 80, align: "right" });
      doc.text(`₹${item.price * item.quantity}`, 460, yPosition, {
        width: 90,
        align: "right",
      });
      yPosition += 30;
    });

    doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();

    // Totals
    yPosition += 20;
    doc.text("Subtotal:", 380, yPosition, { width: 80, align: "right" });
    doc.text(`₹${order.totalAmount}`, 460, yPosition, {
      width: 90,
      align: "right",
    });

    yPosition += 20;
    doc.text("Delivery:", 380, yPosition, { width: 80, align: "right" });
    doc
      .fillColor("#16a34a")
      .text("FREE", 460, yPosition, { width: 90, align: "right" })
      .fillColor("#000");

    yPosition += 20;
    doc.moveTo(380, yPosition).lineTo(550, yPosition).stroke();

    yPosition += 10;
    doc.fontSize(12).text("Total:", 380, yPosition, {
      width: 80,
      align: "right",
    });
    doc.text(`₹${order.totalAmount}`, 460, yPosition, {
      width: 90,
      align: "right",
    });

    doc.fontSize(8).text("Thank you for your business!", 50, 700, {
      align: "center",
      width: 500,
    });

    doc.end();
  } catch (error) {
    console.error("Error generating invoice:", error);
    res.status(500).json({ message: "Error generating invoice" });
  }
};