<script setup>
    import { useRouter } from 'vue-router';
    import { ref, computed, onMounted } from 'vue';
import moment from 'moment';

    const router = useRouter();

    const data = ref({
      store: {
        address: '53 Street, Between 36 & 37 ST (MA-68/2), Ye Mon Taung Quater, Mandalay',
        phone: '+959740010055',
      },
      receiptNo: '20250922043768',
      cashier: 'Ma Su Latt',
      counter: 'C-001',
      date: moment().format("DD/MM/YY hh:mm"),
      currency: 'Ks. ',
      taxRate: 3,
      items: [
          { id: 1, name: 'UltraComfort Ergonomic Mesh Office Chair for Home Theater & Outdoor Use ', qty: 2000, price: 1000000 },
          { id: 2, name: 'SmartSync Ultra 4K Wi-Fi Projector for Home Theater & Outdoor Use', qty: 100, price: 20000 },
          { id: 3, name: 'RadiantGlow Vitamin C Brightening Serum for Home Theater & Outdoor Use', qty: 500, price: 4500 },
          { id: 4, name: 'ProBlend 900-Watt High-Speed Countertop for Home Theater & Outdoor Use', qty: 200, price: 250000 },
      ],
    });

    const subtotal = computed(() => {
      return data.value.items.reduce((sum, item) => sum + item.qty * item.price, 0);
    });

    const tax = computed (() => {
      return (subtotal.value * data.value.taxRate) / 100;
    });

    const total = computed(() => {
      return
    });
    

    // export default {
    // name: 'Receipt',
    // data() {
    //     return {
    //     store: {
    //         address: '53 Street, Between 36 & 37 ST (MA-68/2), Ye Mon Taung Quater, Mandalay',
    //         phone: '+959740010055',
    //     },
    //     receiptNo: '20250922043768',
    //     cashier: 'Ma Su Latt',
    //     counter: 'C-001',
    //     date: new Date().toLocaleString(),
    //     currency: 'Ks. ',
    //     taxRate: 3,
    //     items: [
    //         { id: 1, name: 'Product', qty: 2, price: 10000 },
    //         { id: 2, name: 'Product', qty: 1, price: 2000 },
    //         { id: 3, name: 'Product', qty: 5, price: 4500 },
    //         { id: 4, name: 'Product', qty: 2, price: 25000 },
    //     ],
    //     };
    // },
    // computed: {
    //     subtotal() {
    //     return this.items.reduce((sum, item) => sum + item.qty * item.price, 0);
    //     },
    //     tax() {
    //     return (this.subtotal * this.taxRate) / 100;
    //     },
    //     total() {
    //     return this.subtotal + this.tax;
    //     },
    // },

    // };
</script>

<template>
  <div class="max-w-sm mx-auto m-15 p-4 bg-white shadow-md border border-gray-300 rounded-md text-sm font-mono text-black">
    <!-- Header -->
    <header class="text-center pb-5 mb-2">
      <h1 class="text-lg font-bold">FUSION MART</h1>
      <p>{{ data.store.address }}</p>
      <p>Tel: {{ data.store.phone }}</p>
    </header>

    <!-- Receipt Info -->
    <div class="flex justify-between border-b border-dashed text-xs mb-8">
      <div>
        <p><span class="font-semibold">Receipt :</span> {{ data.receiptNo }}</p>
        <p><span class="font-semibold">Counter :</span> {{ data.counter }}</p>
      </div>
      <div class="text-left">
        <p><span class="font-semibold">Cashier :</span> {{ data.cashier }}</p>
        <p><span class="font-semibold">Date :</span> {{ data.date }}</p>
      </div>
    </div>



    <!-- Items Table -->
    <!-- <div class="border-b py-2 mb-2">
      <div class="grid grid-cols-4 font-semibold pb-1">
        <div>DESCRIPTION</div>
        <div class="text-center">QTY</div>
        <div class="text-right">PRICE</div>
        <div class="text-right">TOTAL</div>
      </div>
      <div v-for="item in data.items" :key="item.id" class="grid grid-cols-4 py-1 border-t border-gray-100 border-opacity-50">
        <div>{{ item.name }}</div>
        <div class="text-center">{{ item.qty }}</div>
        <div class="text-right">{{ item.price.toLocaleString() }}</div>
        <div class="text-right">{{ (item.qty * item.price).toLocaleString() }}</div>
      </div>
    </div> -->

    <table class="w-full text-xs border-b border-gray-300 mb-4">
      <thead>
        <tr class="font-semibold text-left border-b border-dashed">
          <th class="py-1">Description</th>
          <th class="py-1 text-center">Qty</th>
          <th class="py-1 text-right">Price</th>
          <th class="py-1 text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in data.items" :key="item.id" class="border-t border-gray-100">
          <td class="py-0.5 line-clamp-2 w-[150px]">{{ item.name }}</td>
          <td class="py-1 text-center">{{ item.qty }}</td>
          <td class="py-1 pr-1 text-right">{{ item.price.toLocaleString() }}</td>
          <td class="py-1 text-right">{{ (item.qty * item.price).toLocaleString() }}</td>
        </tr>
      </tbody>
    </table>


    <!-- Totals -->
    <div class="text-right space-y-1 mb-8">
      <div class="flex justify-between">
        <span>SUBTOTAL</span>
        <span>{{ data.currency + subtotal.toLocaleString() }}</span>
      </div>
      <div class="flex justify-between">
        <span>TAX ({{ data.taxRate }}%)</span>
        <span>{{ data.currency + tax.toLocaleString() }}</span>
      </div>
      <div class="flex justify-between text-lg font-bold border-t pt-1">
        <span>TOTAL</span>
        <span>{{ data.currency + (subtotal + tax).toLocaleString() }}</span>
      </div>
    </div>

    <!-- Footer -->
    <footer class="text-center border-t border-dashed pt-2 text-xs">
      <p>Thanks for shopping with us!</p>
      <p>Keep this receipt for your records</p>
    </footer>
  </div>
</template>