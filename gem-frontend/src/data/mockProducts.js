// src/data/mockProducts.js

export const defaultProductCategories = [
  { id: "cat_drinks", name: "Drinks", type: "Liquid", stockQty: 500 },
  { id: "cat_tshirts", name: "T-Shirts", type: "Clothes", stockQty: 500 },
  { id: "cat_supplements", name: "Supplements", type: "Food", stockQty: 500 },
  { id: "cat_snacks", name: "Snacks", type: "Food", stockQty: 500 },
];

export const defaultProducts = [
  { id: "prd_1", name: "Water", categoryId: "cat_drinks", price: 500, stock: 26 },
  { id: "prd_2", name: "Water", categoryId: "cat_drinks", price: 500, stock: 26 },
  { id: "prd_3", name: "Water", categoryId: "cat_drinks", price: 500, stock: 26 },
  { id: "prd_4", name: "Water", categoryId: "cat_drinks", price: 500, stock: 26 },
];
