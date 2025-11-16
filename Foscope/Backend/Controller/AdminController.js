import User from "../Model/UserModel.js";
import Order from '../Model/OrderModel.js';
import Product from '../Model/ProductModel.js';
import Gallery from '../Model/GalleryModel.js';


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
    console.log("first")
    const { id } = req.params;
    console.log("first",id)

    const { status, note } = req.body;

    const validStatuses = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

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

    // If cancelled, can add cancel reason from note
    if (status === 'Cancelled' && note) {
      order.cancelReason = note;
    }

    await order.save();

    // Populate for response
    const updatedOrder = await Order.findById(id)
      .populate('user', 'name email mobile')
      .populate('items.product', 'name images');

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
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

    // Handle image type - upload images directly
    if (mediaType === 'image' && req.files && req.files['images']) {
      mediaUrls = req.files['images'].map(file => file.location);
    } 
    // Handle Instagram/YouTube - upload thumbnail and store external URL
    else if ((mediaType === 'instagram' || mediaType === 'youtube') && mediaUrl) {
      mediaUrls = [mediaUrl];
      
      // Check if thumbnail was uploaded
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

    // Handle image type updates
    if (mediaType === 'image') {
      if (req.files && req.files['images'] && req.files['images'].length > 0) {
        mediaUrls = req.files['images'].map(file => file.location);
      }
      // Clear thumbnail if switching to image type
      thumbnailUrl = null;
    } 
    // Handle Instagram/YouTube updates
    else if (mediaType === 'instagram' || mediaType === 'youtube') {
      if (mediaUrl) {
        mediaUrls = [mediaUrl];
      }
      
      // Update thumbnail if new one is uploaded
      if (req.files && req.files['thumbnail'] && req.files['thumbnail'][0]) {
        thumbnailUrl = req.files['thumbnail'][0].location;
      }
      // If no new thumbnail and no existing thumbnail, return error
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