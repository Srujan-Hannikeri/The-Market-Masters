const { Product, User } = require('../models');

exports.getAllProducts = async (req, res) => {
  try {
    const { search, category, lowStock, page = 1, limit = 100 } = req.query;
    
    const query = { isActive: true };
    
    if (req.user.role === 'shopkeeper') {
      query.userId = req.user.id;
    }

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    if (category) {
      query.category = category;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const count = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate('User', 'name shopName')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      products,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Error fetching products.', error: error.message });
  }
};

exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }
    res.json({ product });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching product.', error: error.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const { name, description, price, mrp, costPrice, agencyName, stock, lowStockThreshold, expiryDate, category, barcode, image } = req.body;
    const trimmedName = name.trim();
    const mrpValue = mrp !== undefined ? Number(mrp) : (price !== undefined ? Number(price) : 0);

    const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Match existing product by same name AND same MRP (within ±0.01 tolerance)
    const existingProduct = await Product.findOne({
      userId: req.user.id,
      name: { $regex: `^${escapedName}$`, $options: 'i' },
      mrp: { $gte: mrpValue - 0.01, $lte: mrpValue + 0.01 }
    });

    if (existingProduct) {
      const newStock = Number(existingProduct.stock) + Number(stock || 0);
      existingProduct.stock = newStock;
      existingProduct.isActive = true;
      if (price !== undefined) existingProduct.price = price;
      if (mrp !== undefined) existingProduct.mrp = mrp;
      if (costPrice !== undefined) existingProduct.costPrice = costPrice;
      if (agencyName !== undefined) existingProduct.agencyName = agencyName;
      if (description !== undefined) existingProduct.description = description;
      if (lowStockThreshold !== undefined) existingProduct.minStock = lowStockThreshold;
      if (category !== undefined) existingProduct.category = category;
      if (barcode !== undefined) existingProduct.barcode = barcode;
      if (image !== undefined) existingProduct.image = image;

      await existingProduct.save();

      return res.status(200).json({ 
        message: `Product stock updated. Added ${stock} units to "${existingProduct.name}" (MRP ₹${mrpValue}).`,
        product: existingProduct,
        stockUpdated: true
      });
    }
    
    const product = await Product.create({
      userId: req.user.id,
      name: trimmedName,
      description: description || '',
      price,
      mrp: mrp !== undefined ? mrp : price,
      costPrice: costPrice || 0,
      agencyName: agencyName || '',
      stock,
      minStock: lowStockThreshold || 5,
      expiryDate: expiryDate || null,
      category: category || 'General',
      barcode: barcode || '',
      image: image || '',
      isActive: true
    });

    res.status(201).json({ message: 'Product created successfully.', product, stockUpdated: false });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: 'Error creating product.', error: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    const { name, description, price, mrp, costPrice, agencyName, stock, lowStockThreshold, expiryDate, category, barcode, image, isActive } = req.body;
    
    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (price !== undefined) product.price = price;
    if (mrp !== undefined) product.mrp = mrp;
    if (costPrice !== undefined) product.costPrice = costPrice;
    if (agencyName !== undefined) product.agencyName = agencyName;
    if (stock !== undefined) product.stock = stock;
    if (lowStockThreshold !== undefined) product.minStock = lowStockThreshold;
    if (expiryDate !== undefined) product.expiryDate = expiryDate;
    if (category !== undefined) product.category = category;
    if (barcode !== undefined) product.barcode = barcode;
    if (image !== undefined) product.image = image;
    if (isActive !== undefined) product.isActive = isActive;

    await product.save();

    res.json({ message: 'Product updated successfully.', product });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Error updating product.', error: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    res.json({ message: 'Product deleted successfully.' });
  } catch (error) {
    console.error('Delete error:', error.message);
    res.status(500).json({ message: 'Error deleting product.', error: error.message });
  }
};

exports.getLowStockProducts = async (req, res) => {
  try {
    const products = await Product.find({
      userId: req.user.id,
      isActive: true,
      $expr: { $lte: ['$stock', '$minStock'] }
    }).sort({ stock: 1 });

    res.json({ products });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching low stock products.', error: error.message });
  }
};

exports.getExpiringProducts = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + parseInt(days));

    const products = await Product.find({
      userId: req.user.id,
      isActive: true,
      expiryDate: { $lte: expiryDate, $gte: new Date() }
    }).sort({ expiryDate: 1 });

    res.json({ products });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching expiring products.', error: error.message });
  }
};

exports.updateStock = async (req, res) => {
  try {
    const { quantity } = req.body;
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    const newStock = product.stock + parseInt(quantity);
    if (newStock < 0) {
      return res.status(400).json({ message: 'Insufficient stock.' });
    }

    product.stock = newStock;
    await product.save();
    res.json({ message: 'Stock updated successfully.', product });
  } catch (error) {
    res.status(500).json({ message: 'Error updating stock.', error: error.message });
  }
};
