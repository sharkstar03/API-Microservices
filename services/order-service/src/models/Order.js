const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Esquema para elementos de línea (productos)
const orderItemSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true,
  },
  sku: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  salePrice: {
    type: Number,
    min: 0,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0,
  },
  taxes: {
    type: Number,
    default: 0,
    min: 0,
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
  },
  total: {
    type: Number,
    required: true,
    min: 0,
  },
  attributes: {
    type: Map,
    of: String,
    default: {},
  },
  isDigital: {
    type: Boolean,
    default: false,
  },
  downloadUrl: {
    type: String,
  },
  image: {
    type: String,
  },
  weight: {
    type: Number,
    min: 0,
  },
  notes: {
    type: String,
  },
});

// Esquema para dirección
const addressSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  addressLine1: {
    type: String,
    required: true,
  },
  addressLine2: {
    type: String,
  },
  city: {
    type: String,
    required: true,
  },
  state: {
    type: String,
    required: true,
  },
  postalCode: {
    type: String,
    required: true,
  },
  country: {
    type: String,
    required: true,
  },
  phoneNumber: {
    type: String,
  },
  instructions: {
    type: String,
  },
});

// Esquema para información de pago
const paymentSchema = new mongoose.Schema({
  method: {
    type: String,
    required: true,
    enum: ['credit_card', 'paypal', 'bank_transfer', 'cash', 'other'],
  },
  transactionId: {
    type: String,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  currency: {
    type: String,
    required: true,
    default: 'USD',
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'pending',
  },
  provider: {
    type: String,
  },
  notes: {
    type: String,
  },
  paidAt: {
    type: Date,
  },
});

// Esquema para información de envío
const shippingSchema = new mongoose.Schema({
  method: {
    type: String,
    required: true,
  },
  carrier: {
    type: String,
  },
  trackingNumber: {
    type: String,
  },
  cost: {
    type: Number,
    required: true,
    min: 0,
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'returned', 'cancelled'],
    default: 'pending',
  },
  estimatedDelivery: {
    type: Date,
  },
  shippedAt: {
    type: Date,
  },
  deliveredAt: {
    type: Date,
  },
  weight: {
    type: Number,
    min: 0,
  },
  dimensions: {
    type: Map,
    of: Number,
  },
  notes: {
    type: String,
  },
});

// Esquema para descuentos
const discountSchema = new mongoose.Schema({
  code: {
    type: String,
  },
  type: {
    type: String,
    enum: ['percentage', 'fixed_amount', 'free_shipping'],
  },
  amount: {
    type: Number,
    min: 0,
  },
  description: {
    type: String,
  },
});

// Esquema principal de la orden
const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: [
        'pending',
        'processing',
        'payment_pending',
        'paid',
        'shipped',
        'delivered',
        'completed',
        'cancelled',
        'refunded',
        'failed',
        'on_hold'
      ],
      default: 'pending',
    },
    items: [orderItemSchema],
    shippingAddress: addressSchema,
    billingAddress: addressSchema,
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    taxAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    discountAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    shippingAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: 'USD',
    },
    payment: paymentSchema,
    shipping: shippingSchema,
    discounts: [discountSchema],
    notes: {
      type: String,
    },
    customerNotes: {
      type: String,
    },
    adminNotes: {
      type: String,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    completedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Índices
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ userId: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: 1 });
orderSchema.index({ "payment.status": 1 });
orderSchema.index({ "shipping.status": 1 });

// Middleware pre-save para generar número de orden
orderSchema.pre('save', function(next) {
  if (!this.orderNumber) {
    const prefix = 'ORD';
    const timestamp = Math.floor(Date.now() / 1000).toString(36).toUpperCase();
    const randomStr = uuidv4().substring(0, 4).toUpperCase();
    this.orderNumber = `${prefix}-${timestamp}-${randomStr}`;
  }
  next();
});

// Método para calcular totales
orderSchema.methods.calculateTotals = function() {
  // Calcular subtotal y total de items
  let subtotal = 0;
  let taxAmount = 0;
  
  this.items.forEach(item => {
    // Calcular precio por item (usando precio de oferta si existe)
    const price = item.salePrice > 0 ? item.salePrice : item.price;
    
    // Calcular subtotal del item
    const itemSubtotal = price * item.quantity;
    
    // Actualizar el subtotal del item
    item.subtotal = itemSubtotal;
    
    // Actualizar el total del item
    item.total = itemSubtotal + item.taxes - item.discount;
    
    // Acumular al total de la orden
    subtotal += itemSubtotal;
    taxAmount += item.taxes || 0;
  });
  
  // Actualizar campos de la orden
  this.subtotal = subtotal;
  this.taxAmount = taxAmount;
  
  // Calcular el total con impuestos, descuentos y envío
  this.total = this.subtotal + this.taxAmount - this.discountAmount + this.shippingAmount;
  
  return this;
};

// Método para cambiar el estado de la orden
orderSchema.methods.updateStatus = function(newStatus, notes = '') {
  const prevStatus = this.status;
  this.status = newStatus;
  
  // Registrar fechas para estados específicos
  if (newStatus === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  } else if (newStatus === 'cancelled' && !this.cancelledAt) {
    this.cancelledAt = new Date();
  } else if (newStatus === 'shipped' && !this.shipping.shippedAt) {
    this.shipping.shippedAt = new Date();
  } else if (newStatus === 'delivered' && !this.shipping.deliveredAt) {
    this.shipping.deliveredAt = new Date();
  } else if (newStatus === 'paid' && !this.payment.paidAt) {
    this.payment.paidAt = new Date();
  }
  
  // Añadir notas si se proporcionan
  if (notes) {
    if (this.adminNotes) {
      this.adminNotes += `\n${new Date().toISOString()} - ${prevStatus} → ${newStatus}: ${notes}`;
    } else {
      this.adminNotes = `${new Date().toISOString()} - ${prevStatus} → ${newStatus}: ${notes}`;
    }
  }
  
  return this;
};

// Método para añadir un producto a la orden
orderSchema.methods.addItem = function(item) {
  // Comprobar si el producto ya existe en la orden
  const existingItemIndex = this.items.findIndex(i => i.productId === item.productId);
  
  if (existingItemIndex >= 0) {
    // Incrementar cantidad si ya existe
    this.items[existingItemIndex].quantity += item.quantity;
    this.items[existingItemIndex].subtotal = this.items[existingItemIndex].price * this.items[existingItemIndex].quantity;
    this.items[existingItemIndex].total = this.items[existingItemIndex].subtotal + this.items[existingItemIndex].taxes - this.items[existingItemIndex].discount;
  } else {
    // Añadir nuevo item
    const newItem = {
      ...item,
      subtotal: item.price * item.quantity,
      total: (item.price * item.quantity) + (item.taxes || 0) - (item.discount || 0)
    };
    this.items.push(newItem);
  }
  
  // Recalcular totales
  this.calculateTotals();
  
  return this;
};

// Método para eliminar un producto de la orden
orderSchema.methods.removeItem = function(productId) {
  // Encontrar el índice del item
  const itemIndex = this.items.findIndex(item => item.productId === productId);
  
  if (itemIndex >= 0) {
    // Eliminar el item
    this.items.splice(itemIndex, 1);
    
    // Recalcular totales
    this.calculateTotals();
  }
  
  return this;
};

// Método para aplicar un descuento
orderSchema.methods.applyDiscount = function(discount) {
  // Añadir descuento a la lista
  this.discounts.push(discount);
  
  // Calcular monto del descuento
  if (discount.type === 'percentage') {
    this.discountAmount += (this.subtotal * discount.amount) / 100;
  } else if (discount.type === 'fixed_amount') {
    this.discountAmount += discount.amount;
  } else if (discount.type === 'free_shipping') {
    this.discountAmount += this.shippingAmount;
    this.shippingAmount = 0;
  }
  
  // Recalcular total
  this.total = this.subtotal + this.taxAmount - this.discountAmount + this.shippingAmount;
  
  return this;
};

// Método para actualizar información de pago
orderSchema.methods.updatePayment = function(paymentInfo) {
  this.payment = { ...this.payment, ...paymentInfo };
  
  // Si el pago está completado, actualizar estado de la orden
  if (paymentInfo.status === 'completed' && this.status === 'payment_pending') {
    this.updateStatus('paid', 'Pago recibido y confirmado');
  }
  
  return this;
};

// Método para actualizar información de envío
orderSchema.methods.updateShipping = function(shippingInfo) {
  this.shipping = { ...this.shipping, ...shippingInfo };
  
  // Actualizar estado de la orden según el estado del envío
  if (shippingInfo.status === 'shipped' && this.status === 'processing') {
    this.updateStatus('shipped', 'Orden enviada');
  } else if (shippingInfo.status === 'delivered' && this.status === 'shipped') {
    this.updateStatus('delivered', 'Orden entregada');
  }
  
  return this;
};

// Método estático para buscar órdenes pendientes de pago
orderSchema.statics.findPendingPayments = function() {
  return this.find({ 
    status: 'payment_pending',
    createdAt: { $gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Órdenes de los últimos 7 días
  });
};

// Método estático para buscar órdenes por usuario
orderSchema.statics.findByUser = function(userId, filter = {}) {
  return this.find({ 
    userId,
    ...filter
  }).sort({ createdAt: -1 });
};

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;