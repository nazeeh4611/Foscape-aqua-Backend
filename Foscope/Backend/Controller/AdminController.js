import User from "../Model/UserModel.js";
import Order from '../Model/OrderModel.js';
import Product from '../Model/ProductModel.js';
import Gallery from '../Model/GalleryModel.js';
import sendEmail from "../Utils/SendMail.js";


export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.status(200).json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleUserBlockStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    user.isBlocked = !user.isBlocked;
    await user.save();
    res.status(200).json({ 
      success: true, 
      message: `User ${user.isBlocked ? 'blocked' : 'unblocked'} successfully`,
      user: { _id: user._id, isBlocked: user.isBlocked }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { name, email, mobile, isVerified, address } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (name) user.name = name;
    if (email) user.email = email;
    if (mobile) user.mobile = mobile;
    if (typeof isVerified !== 'undefined') user.isVerified = isVerified;
    if (address) user.address = address;
    await user.save();
    res.status(200).json({ success: true, message: 'User updated successfully', user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name email mobile')
      .populate('items.product', 'name images')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      orders,
      count: orders.length
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id)
      .populate('user', 'name email mobile')
      .populate('items.product', 'name images price');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
      error: error.message
    });
  }
};

// Update order status (Admin)
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const { status, note } = req.body;

    const validStatuses = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const order = await Order.findById(id).populate('user');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Store previous status to check if changing to Cancelled
    const previousStatus = order.orderStatus;

    // Update order status
    order.orderStatus = status;

    // Add to status history
    order.statusHistory.push({
      status,
      timestamp: new Date(),
      note: note || ''
    });

    // If delivered, set delivery date
    if (status === 'Delivered' && !order.deliveryDate) {
      order.deliveryDate = new Date();
    }

    // If cancelled by admin, restore stock and send email
    if (status === 'Cancelled') {
      order.cancelReason = note || 'Cancelled by admin';
      
      // Restore product stock
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: item.quantity },
        });
      }

      // Send cancellation email to user
      try {
        const user = order.user; // Already populated
        const emailSubject = "Your Order Has Been Cancelled";
        const emailMessage = adminOrderCancelledEmail(user, order, note);
        
        await sendEmail(user.email, emailSubject, emailMessage);
      } catch (emailError) {
        console.error('Error sending cancellation email:', emailError);
        // Continue even if email fails
      }
    }

    await order.save();

    // Populate for response
    const updatedOrder = await Order.findById(id)
      .populate('user', 'name email mobile')
      .populate('items.product', 'name images');

    res.status(200).json({
      success: true,
      message: status === 'Cancelled' 
        ? 'Order cancelled successfully and customer notified via email'
        : 'Order status updated successfully',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error.message
    });
  }
};

// Update payment status (Admin)
export const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;

    const validPaymentStatuses = ['Pending', 'Paid', 'Failed'];
    
    if (!validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment status value'
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    order.paymentStatus = paymentStatus;
    await order.save();

    const updatedOrder = await Order.findById(id)
      .populate('user', 'name email mobile')
      .populate('items.product', 'name images');

    res.status(200).json({
      success: true,
      message: 'Payment status updated successfully',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment status',
      error: error.message
    });
  }
};

// Delete order (Admin)
export const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    await Order.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Order deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete order',
      error: error.message
    });
  }
};

// Get order statistics (Admin)
export const getOrderStats = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ orderStatus: 'Pending' });
    const confirmedOrders = await Order.countDocuments({ orderStatus: 'Confirmed' });
    const processingOrders = await Order.countDocuments({ orderStatus: 'Processing' });
    const shippedOrders = await Order.countDocuments({ orderStatus: 'Shipped' });
    const deliveredOrders = await Order.countDocuments({ orderStatus: 'Delivered' });
    const cancelledOrders = await Order.countDocuments({ orderStatus: 'Cancelled' });

    const paidOrders = await Order.countDocuments({ paymentStatus: 'Paid' });
    const pendingPayments = await Order.countDocuments({ paymentStatus: 'Pending' });

    // Calculate total revenue (only from paid orders)
    const revenueResult = await Order.aggregate([
      { $match: { paymentStatus: 'Paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    // Recent orders
    const recentOrders = await Order.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      stats: {
        totalOrders,
        ordersByStatus: {
          pending: pendingOrders,
          confirmed: confirmedOrders,
          processing: processingOrders,
          shipped: shippedOrders,
          delivered: deliveredOrders,
          cancelled: cancelledOrders
        },
        paymentStats: {
          paid: paidOrders,
          pending: pendingPayments
        },
        totalRevenue,
        recentOrders
      }
    });
  } catch (error) {
    console.error('Error fetching order stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order statistics',
      error: error.message
    });
  }
};

// Get orders by user (Admin can view any user's orders)
export const getOrdersByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const orders = await Order.find({ user: userId })
      .populate('items.product', 'name images price')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      orders,
      count: orders.length
    });
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user orders',
      error: error.message
    });
  }
};

// Search orders (Admin)
export const searchOrders = async (req, res) => {
  try {
    const { query, status, paymentStatus, startDate, endDate } = req.query;

    let filter = {};

    // Search by order number or customer details
    if (query) {
      const users = await User.find({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } }
        ]
      }).select('_id');

      const userIds = users.map(u => u._id);

      filter.$or = [
        { orderNumber: { $regex: query, $options: 'i' } },
        { user: { $in: userIds } }
      ];
    }

    // Filter by order status
    if (status && status !== 'All') {
      filter.orderStatus = status;
    }

    // Filter by payment status
    if (paymentStatus && paymentStatus !== 'All') {
      filter.paymentStatus = paymentStatus;
    }

    // Filter by date range
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const orders = await Order.find(filter)
      .populate('user', 'name email mobile')
      .populate('items.product', 'name images')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      orders,
      count: orders.length
    });
  } catch (error) {
    console.error('Error searching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search orders',
      error: error.message
    });
  }
};



export const getAllGallery = async (req, res) => {
  try {
    const gallery = await Gallery.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, gallery });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addGalleryItem = async (req, res) => {
  try {
    const { heading, description, mediaType, mediaUrl, location, status } = req.body;

    let mediaUrls = [];
    let thumbnailUrl = null;

    if (mediaType === 'image' && req.files && req.files['images']) {
      mediaUrls = req.files['images'].map(file => file.location);
    } 
    else if ((mediaType === 'instagram' || mediaType === 'youtube') && mediaUrl) {
      mediaUrls = [mediaUrl];
      
      if (req.files && req.files['thumbnail'] && req.files['thumbnail'][0]) {
        thumbnailUrl = req.files['thumbnail'][0].location;
      } else {
        return res.status(400).json({ 
          success: false, 
          message: 'Thumbnail image is required for Instagram and YouTube posts' 
        });
      }
    } else {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid media data provided' 
      });
    }

    const newGalleryItem = new Gallery({
      heading,
      description,
      mediaType,
      mediaUrls,
      thumbnailUrl,
      location: location || '',
      status: status || 'Active'
    });

    await newGalleryItem.save();
    res.status(201).json({
      success: true,
      message: 'Gallery item added successfully',
      gallery: newGalleryItem
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateGalleryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { heading, description, mediaType, mediaUrl, location, status } = req.body;

    const galleryItem = await Gallery.findById(id);
    if (!galleryItem) {
      return res.status(404).json({ success: false, message: 'Gallery item not found' });
    }

    let mediaUrls = galleryItem.mediaUrls;
    let thumbnailUrl = galleryItem.thumbnailUrl;

    if (mediaType === 'image') {
      if (req.files && req.files['images'] && req.files['images'].length > 0) {
        mediaUrls = req.files['images'].map(file => file.location);
      }
      thumbnailUrl = null;
    } 
    else if (mediaType === 'instagram' || mediaType === 'youtube') {
      if (mediaUrl) {
        mediaUrls = [mediaUrl];
      }
      
      if (req.files && req.files['thumbnail'] && req.files['thumbnail'][0]) {
        thumbnailUrl = req.files['thumbnail'][0].location;
      }
      else if (!thumbnailUrl) {
        return res.status(400).json({ 
          success: false, 
          message: 'Thumbnail image is required for Instagram and YouTube posts' 
        });
      }
    }

    galleryItem.heading = heading;
    galleryItem.description = description;
    galleryItem.mediaType = mediaType;
    galleryItem.mediaUrls = mediaUrls;
    galleryItem.thumbnailUrl = thumbnailUrl;
    galleryItem.location = location || '';
    galleryItem.status = status;

    await galleryItem.save();

    res.status(200).json({
      success: true,
      message: 'Gallery item updated successfully',
      gallery: galleryItem
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteGalleryItem = async (req, res) => {
  try {
    const { id } = req.params;

    const galleryItem = await Gallery.findByIdAndDelete(id);

    if (!galleryItem) {
      return res.status(404).json({ success: false, message: 'Gallery item not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Gallery item deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateGalleryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const galleryItem = await Gallery.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!galleryItem) {
      return res.status(404).json({ success: false, message: 'Gallery item not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Status updated successfully',
      gallery: galleryItem
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


const adminOrderCancelledEmail = (user, order, note) => `
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
      We're sorry, your order has been cancelled
    </p>
  </div>

  <!-- Body -->
  <div style="padding: 25px; color: #333;">
    <p style="font-size: 15px;">Hello <strong>${user.name}</strong>,</p>

    <p style="font-size: 15px;">
      We regret to inform you that your order <strong>${order.orderNumber}</strong> has been cancelled.
    </p>

    ${note ? `
    <div style="
      margin: 20px 0;
      padding: 15px;
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      border-radius: 8px;
    ">
      <p style="margin: 0; font-size: 14px;">
        <strong>Cancellation Reason:</strong><br>
        ${note}
      </p>
    </div>
    ` : ''}

    <!-- Order Details -->
    <div style="
      margin: 20px 0;
      padding: 20px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 6px 14px rgba(20, 78, 140, 0.10);
    ">
      <h3 style="margin: 0 0 12px; color: #144E8C;">Cancelled Order Details</h3>
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
        <strong>Order Total: ₹${order.totalAmount}</strong>
      </p>
    </div>

    ${order.paymentStatus === 'Paid' ? `
    <div style="
      margin: 20px 0;
      padding: 15px;
      background: #d1ecf1;
      border-left: 4px solid #0c5460;
      border-radius: 8px;
    ">
      <p style="margin: 0; font-size: 14px;">
        <strong>Refund Information:</strong><br>
        Your refund will be processed within 5-7 business days to your original payment method.
      </p>
    </div>
    ` : ''}

    <p style="font-size: 14px; margin-top: 20px;">
      If you have any questions or concerns about this cancellation, please don't hesitate to contact our customer support team.
    </p>

    <p style="font-size: 14px; margin-top: 20px; color: #144E8C; font-weight: 600;">
      Best regards,<br/>
      <span style="color: #333; font-weight: 500;">Foscape Team</span>
    </p>
  </div>

  <!-- Footer -->
  <div style="
    padding: 20px;
    text-align: center;
    border-top: 1px solid #e0f2ef;
    color: #666;
    font-size: 12px;
  ">
    <p style="margin: 5px 0;">Need help? Contact us at info@thefoscape.com</p>
    <p style="margin: 5px 0;">Phone: +91-854 748 3891</p>
  </div>
</div>
`;

