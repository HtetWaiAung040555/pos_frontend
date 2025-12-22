import { normalizeApiError } from "@/utils/NormalizeApiError";
import axios from "axios";
import { defineStore } from "pinia";

export const useSaleStore = defineStore('sales', {
    state: () => ({
        salesList: [],
        loading: false,
        deleteLoading: false,
        error: [],
        data: null

    }),
    actions: {
        async fetchAllSales(filteredData) {
            this.loading = true;
            try {
                let response;
                if (filteredData) {
                    response = await axios.get(`/sales?start_date=${filteredData.start_date}&end_date=${filteredData.end_date}&${filteredData.customer_id? customer_id=filteredData.customer_id : ""}&${filteredData.status_id? status_id=filteredData.status_id: ""}`);
                    this.salesList = response.data.data;
                } else {
                    response = await axios.get(`/sales`);
                    this.salesList = response.data.data;
                }
                
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async fetchSales(id) {
            this.loading = true;
            try {
                const response = await axios.get(`/sales/${id}`);
                this.salesList = response.data.data;
            } catch (err) {
               this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async fetchSalesByStatus(status) {
            this.loading = true;
            try {
                const response = await axios.get(`/sales?status_id=${status}`);
                this.salesList = response.data.data;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async addSales(formData) {
            this.loading = true;
            try {
                const response = await axios.post(`/sales`, formData);
                this.salesList = response.data.data;
            } catch(err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async editSales(formData, id) {
            this.loading = true;
            try {
                const response = await axios.put(`/sales/${id}`, formData)
                this.salesList = response.data.data;
                console.log(response);
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.loading = false;
            }
        },
        async deleteSales(data, id) {
            this.deleteLoading = true;
            try {
                const response = await axios.delete(`/sales/${id}`, { data: data });
                this.data = response;
            } catch (err) {
                this.error = normalizeApiError(err);
            } finally {
                this.deleteLoading = false;
            }
        }
    }

});