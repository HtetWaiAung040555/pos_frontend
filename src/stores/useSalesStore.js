import axios from "axios";
import { defineStore } from "pinia";

export const useSaleStore = defineStore('sales', {
    state: () => ({
        salesList: [],
        loading: false,
        deleteLoading: false,
        error: null,
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
                this.error = err.message;
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
                this.error = err.message;
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
                this.error = err.message;
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
                if (err.response && err.response.status === 422) {
                    this.error = err.response.data.errors;
                }
            } finally {
                this.loading = false;
            }
        },
        async editSales(id, formData) {
            this.loading = true;
            try {
                const response = await axios.put(`/sales/${id}`, formData)
                this.salesList = response.data.data
            } catch (err) {
                if (err.response && err.response.status === 422) {
                    this.error = err.response.data.errors;
                }
                
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
                if (err.response && err.response.status === 422) {
                    this.error = err.response.data;
                } else if (err.response && err.response.status === 400) {
                    this.error = err.response.data.error;
                } 
            } finally {
                this.deleteLoading = false;
            }
        }
    }

});