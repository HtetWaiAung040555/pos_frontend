import { normalizeApiError } from "@/utils/NormalizeApiError";
import axios from "axios";
import { defineStore } from "pinia";


export const useProductStore = defineStore('product', {
    state: () => ({
        productList: [],
        loading: false,
        deleteLoading: false,
        error: [],
        data: null,
    }),
    actions: {
        async fetchAllProduct() {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/products`);
                this.productList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async fetchProduct(productId) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/products/${productId}`);
                this.productList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async addProduct(formData) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.post(`/products`, formData);
                this.productList = response.data.data;
            } catch(err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async editProduct(productId, formData) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.post(`/products/${productId}`, formData)
                this.productList = response.data.data
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async deleteProduct(productId) {
            this.deleteLoading = true;
            this.error = [];
            try {
                const response = await axios.delete(`/products/${productId}`);
                this.data = response;
            } catch (err) {
               this.error = normalizeApiError(err);
            } finally {
                this.deleteLoading = false;
            }
        },
        async fetchSalesProduct(data) {
            this.loading = true;
            this.error = [];
            try {
                const response = await axios.get(`/products/saleproducts`, {data: data});
                this.productList = response.data;
                console.log(response);
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
    }
});