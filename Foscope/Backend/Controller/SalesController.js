import Order from '../Model/OrderModel.js';
import Product from '../Model/ProductModel.js';
import User from '../Model/UserModel.js';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

export const getSalesReport = async (req, res) => {
  try {
    const { startDate, endDate, status, paymentStatus, groupBy } = req.query;

    let filter = {};

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    if (status && status !== 'All') {
      filter.orderStatus = status;
    }

    if (paymentStatus && paymentStatus !== 'All') {
      filter.paymentStatus = paymentStatus;
    }

    const orders = await Order.find(filter)
      .populate('user', 'name email')
      .populate('items.product', 'name category')
      .sort({ createdAt: -1 });

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const paidOrders = orders.filter(o => o.paymentStatus === 'Paid');
    const totalPaidRevenue = paidOrders.reduce((sum, order) => sum + order.totalAmount, 0);

    const ordersByStatus = {
      Pending: orders.filter(o => o.orderStatus === 'Pending').length,
      Confirmed: orders.filter(o => o.orderStatus === 'Confirmed').length,
      Processing: orders.filter(o => o.orderStatus === 'Processing').length,
      Shipped: orders.filter(o => o.orderStatus === 'Shipped').length,
      Delivered: orders.filter(o => o.orderStatus === 'Delivered').length,
      Cancelled: orders.filter(o => o.orderStatus === 'Cancelled').length,
    };

    const paymentMethodStats = {
      COD: orders.filter(o => o.paymentMethod === 'COD').length,
      Razorpay: orders.filter(o => o.paymentMethod === 'Razorpay').length,
    };

    const productSales = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        const productName = item.name || 'Unknown Product';
        if (!productSales[productName]) {
          productSales[productName] = {
            name: productName,
            quantity: 0,
            revenue: 0,
            orders: 0,
          };
        }
        productSales[productName].quantity += item.quantity;
        productSales[productName].revenue += item.price * item.quantity;
        productSales[productName].orders += 1;
      });
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const customerStats = {};
    orders.forEach(order => {
      const userId = order.user?._id?.toString();
      const userName = order.user?.name || 'Unknown';
      if (!customerStats[userId]) {
        customerStats[userId] = {
          name: userName,
          email: order.user?.email || 'N/A',
          orders: 0,
          totalSpent: 0,
        };
      }
      customerStats[userId].orders += 1;
      customerStats[userId].totalSpent += order.totalAmount;
    });

    const topCustomers = Object.values(customerStats)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    let salesOverTime = [];
    if (groupBy === 'daily') {
      const dailyStats = {};
      orders.forEach(order => {
        const date = new Date(order.createdAt).toISOString().split('T')[0];
        if (!dailyStats[date]) {
          dailyStats[date] = { date, orders: 0, revenue: 0 };
        }
        dailyStats[date].orders += 1;
        dailyStats[date].revenue += order.totalAmount;
      });
      salesOverTime = Object.values(dailyStats).sort((a, b) => new Date(a.date) - new Date(b.date));
    } else if (groupBy === 'monthly') {
      const monthlyStats = {};
      orders.forEach(order => {
        const date = new Date(order.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyStats[monthKey]) {
          monthlyStats[monthKey] = { date: monthKey, orders: 0, revenue: 0 };
        }
        monthlyStats[monthKey].orders += 1;
        monthlyStats[monthKey].revenue += order.totalAmount;
      });
      salesOverTime = Object.values(monthlyStats).sort((a, b) => a.date.localeCompare(b.date));
    }

    res.status(200).json({
      success: true,
      report: {
        summary: {
          totalOrders,
          totalRevenue,
          totalPaidRevenue,
          averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        },
        ordersByStatus,
        paymentMethodStats,
        topProducts,
        topCustomers,
        salesOverTime,
        orders: orders.map(order => ({
          orderNumber: order.orderNumber,
          date: order.createdAt,
          customer: order.user?.name || 'Unknown',
          email: order.user?.email || 'N/A',
          items: order.items.length,
          amount: order.totalAmount,
          status: order.orderStatus,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
        })),
      },
    });
  } catch (error) {
    console.error('Error generating sales report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate sales report',
      error: error.message,
    });
  }
};

export const downloadSalesReportPDF = async (req, res) => {
  try {
    const { startDate, endDate, status, paymentStatus } = req.query;

    let filter = {};

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    if (status && status !== 'All') {
      filter.orderStatus = status;
    }

    if (paymentStatus && paymentStatus !== 'All') {
      filter.paymentStatus = paymentStatus;
    }

    const orders = await Order.find(filter)
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const paidRevenue = orders.filter(o => o.paymentStatus === 'Paid').reduce((sum, order) => sum + order.totalAmount, 0);

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=sales-report-${Date.now()}.pdf`);

    doc.pipe(res);

    doc.fontSize(20).text('Sales Report', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
    if (startDate || endDate) {
      doc.text(`Period: ${startDate || 'Start'} to ${endDate || 'End'}`, { align: 'center' });
    }
    doc.moveDown(2);

    doc.fontSize(14).text('Summary', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`Total Orders: ${orders.length}`);
    doc.text(`Total Revenue: ₹${totalRevenue.toFixed(2)}`);
    doc.text(`Paid Revenue: ₹${paidRevenue.toFixed(2)}`);
    doc.text(`Average Order Value: ₹${orders.length > 0 ? (totalRevenue / orders.length).toFixed(2) : '0.00'}`);
    doc.moveDown(2);

    doc.fontSize(14).text('Order Details', { underline: true });
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const tableHeaders = ['Order #', 'Date', 'Customer', 'Amount', 'Status'];
    const columnWidths = [100, 80, 120, 80, 80];
    let xPosition = 50;

    doc.fontSize(9).fillColor('#000');
    tableHeaders.forEach((header, i) => {
      doc.text(header, xPosition, tableTop, { width: columnWidths[i], align: 'left' });
      xPosition += columnWidths[i];
    });

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    let yPosition = tableTop + 20;
    orders.forEach((order, index) => {
      if (yPosition > 700) {
        doc.addPage();
        yPosition = 50;
      }

      xPosition = 50;
      const rowData = [
        order.orderNumber,
        new Date(order.createdAt).toLocaleDateString(),
        order.user?.name || 'Unknown',
        `₹${order.totalAmount.toFixed(2)}`,
        order.orderStatus,
      ];

      rowData.forEach((data, i) => {
        doc.text(data, xPosition, yPosition, { width: columnWidths[i], align: 'left' });
        xPosition += columnWidths[i];
      });

      yPosition += 20;
    });

    doc.end();
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF report',
      error: error.message,
    });
  }
};

export const downloadSalesReportExcel = async (req, res) => {
  try {
    const { startDate, endDate, status, paymentStatus } = req.query;

    let filter = {};

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    if (status && status !== 'All') {
      filter.orderStatus = status;
    }

    if (paymentStatus && paymentStatus !== 'All') {
      filter.paymentStatus = paymentStatus;
    }

    const orders = await Order.find(filter)
      .populate('user', 'name email mobile')
      .populate('items.product', 'name')
      .sort({ createdAt: -1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    worksheet.columns = [
      { header: 'Order Number', key: 'orderNumber', width: 20 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Customer Name', key: 'customerName', width: 25 },
      { header: 'Customer Email', key: 'customerEmail', width: 30 },
      { header: 'Customer Mobile', key: 'customerMobile', width: 15 },
      { header: 'Items Count', key: 'itemsCount', width: 12 },
      { header: 'Total Amount', key: 'totalAmount', width: 15 },
      { header: 'Payment Method', key: 'paymentMethod', width: 15 },
      { header: 'Payment Status', key: 'paymentStatus', width: 15 },
      { header: 'Order Status', key: 'orderStatus', width: 15 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    orders.forEach(order => {
      worksheet.addRow({
        orderNumber: order.orderNumber,
        date: new Date(order.createdAt).toLocaleDateString(),
        customerName: order.user?.name || 'Unknown',
        customerEmail: order.user?.email || 'N/A',
        customerMobile: order.user?.mobile || 'N/A',
        itemsCount: order.items.length,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
      });
    });

    const summaryRow = worksheet.addRow({});
    summaryRow.getCell(6).value = 'Total:';
    summaryRow.getCell(6).font = { bold: true };
    summaryRow.getCell(7).value = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    summaryRow.getCell(7).font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=sales-report-${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating Excel:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate Excel report',
      error: error.message,
    });
  }
};