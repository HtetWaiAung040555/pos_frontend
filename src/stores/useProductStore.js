import axios from "axios";
import { defineStore } from "pinia";


export const useProductStore = defineStore('product', {
    state: () => ({
        productList: [],
        loading: false,
        deleteLoading: false,
        error: null,
        data: null,
    }),
    actions: {
        async fetchAllProduct() {
            this.loading = true;
            try {
                const response = await axios.get(`/products`);
                this.productList = response.data.data;
            } catch (err) {
                this.error = err.message;
            } finally {
                this.loading = false;
            }
        },
        async fetchProduct(productId) {
            this.loading = true;
            try {
                const response = await axios.get(`/products/${productId}`);
                this.productList = response.data.data;
            } catch (err) {
                this.error = err.message;
            } finally {
                this.loading = false;
            }
        },
        async addProduct(formData) {
            this.loading = true;
            try {
                const response = await axios.post(`/products`, formData);
                this.productList = response.data.data;
            } catch(err) {
                if (err.response && err.response.status === 422) {
                    this.error = err.response.data.errors;
                }
            } finally {
                this.loading = false;
            }
        },
        async editProduct(productId, formData) {
            this.loading = true;
            console.log(formData);
            console.log(productId);
            try {
                const response = await axios.post(`/products/${productId}`, formData)
                this.productList = response.data.data
            } catch (err) {
                if (err.response && err.response.status === 422) {
                    this.error = err.response.data.errors;
                }
                
            } finally {
                this.loading = false;
            }
        },
        async deleteProduct(productId) {
            this.deleteLoading = true;
            try {
                const response = await axios.delete(`/products/${productId}`);
                this.data = response;
            } catch (err) {
                if (err.response && err.response.status === 422) {
                    this.error = err.response.data;
                } else if (err.response && err.response.status === 400) {
                    this.error = err.response.data.error;
                } 
            } finally {
                this.deleteLoading = false;
            }
        },
    }
});