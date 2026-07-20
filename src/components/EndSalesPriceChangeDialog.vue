<script setup>
import { computed, ref, watch } from 'vue';
import moment from 'moment';
import Dialog from 'primevue/dialog';
import { useToast } from 'primevue';
import BaseButton from '@/components/BaseButton.vue';
import { usePriceChangeStore } from '@/stores/usePriceChangeStore';

const props = defineProps({
    visible: { type: Boolean, default: false },
    priceChange: { type: Object, default: null },
});

const emit = defineEmits(['update:visible', 'ended']);
const toast = useToast();
const usePriceChange = usePriceChangeStore();

const endMode = ref('now');
const endAt = ref('');
const endReason = ref('');
const localError = ref('');

const productCount = computed(() => new Set(
    (props.priceChange?.products || [])
        .map((item) => item.product_id || item.product?.id)
        .filter(Boolean)
).size);
const priceRowCount = computed(() => (props.priceChange?.products || []).length);
const minimumScheduleAt = computed(() => moment().add(1, 'minute').format('YYYY-MM-DDTHH:mm'));

watch(() => props.visible, (visible) => {
    if (!visible) return;
    endMode.value = 'now';
    endAt.value = '';
    endReason.value = '';
    localError.value = '';
});

function closeDialog() {
    if (usePriceChange.endLoading) return;
    emit('update:visible', false);
}

function selectMode(mode) {
    endMode.value = mode;
    localError.value = '';
    if (mode === 'now') endAt.value = '';
}

function validateSchedule() {
    if (endMode.value !== 'schedule') return true;
    if (!endAt.value) {
        localError.value = 'Select an end date and time.';
        return false;
    }

    const scheduledEnd = moment(endAt.value);
    const startAt = moment(props.priceChange?.start_at || props.priceChange?.startDate);
    if (!scheduledEnd.isValid()) {
        localError.value = 'Enter a valid end date and time.';
        return false;
    }
    if (startAt.isValid() && !scheduledEnd.isAfter(startAt)) {
        localError.value = 'The end date must be after the start date.';
        return false;
    }
    if (!scheduledEnd.isAfter(moment())) {
        localError.value = 'Use End now for the current time, or choose a future end time.';
        return false;
    }
    return true;
}

async function submitEnd() {
    localError.value = '';
    if (props.priceChange?.can_end !== true) {
        localError.value = 'This price change can no longer be ended.';
        return;
    }
    if (!validateSchedule()) return;

    const payload = {};
    const reason = endReason.value.trim();
    if (reason) payload.end_reason = reason;
    if (endMode.value === 'schedule') {
        payload.end_at = moment(endAt.value).format('YYYY-MM-DD HH:mm:ss');
    }

    const result = await usePriceChange.endPriceChange(props.priceChange.id, payload);
    if (!result) {
        localError.value = usePriceChange.error.join(' ') || 'Unable to end this price change.';
        return;
    }

    const scheduled = result.effective_state === 'ending_scheduled';
    toast.add({
        severity: 'success',
        summary: scheduled ? 'End scheduled' : 'Price change ended',
        detail: scheduled
            ? 'The price change will end at the selected time.'
            : 'The price change ended and affected prices were recalculated.',
        life: 3500,
    });
    emit('ended', result);
    emit('update:visible', false);
}
</script>

<template>
    <Dialog
        :visible="visible"
        :modal="true"
        :draggable="false"
        :closable="!usePriceChange.endLoading"
        :style="{ width: 'min(520px, calc(100vw - 24px))' }"
        @update:visible="emit('update:visible', $event)"
    >
        <template #header>
            <div>
                <div class="font-semibold text-black">End price change</div>
                <div class="mt-0.5 text-xs text-gray-500">{{ priceChange?.id }}</div>
            </div>
        </template>

        <div class="space-y-4 text-black">
            <div class="flex flex-wrap gap-x-5 gap-y-1 border-b border-gray-200 pb-3 text-sm text-gray-600">
                <span><strong class="text-black">{{ productCount }}</strong> {{ productCount === 1 ? 'product' : 'products' }}</span>
                <span><strong class="text-black">{{ priceRowCount }}</strong> price rows</span>
            </div>

            <div>
                <label class="mb-1.5 block text-sm font-medium">When should it end?</label>
                <div class="grid grid-cols-2 overflow-hidden rounded border border-gray-300 p-1">
                    <button
                        type="button"
                        class="rounded px-3 py-2 text-sm font-medium"
                        :class="endMode === 'now' ? 'bg-red-50 text-red-700' : 'text-gray-600 hover:bg-gray-50'"
                        :aria-pressed="endMode === 'now'"
                        @click="selectMode('now')"
                    >
                        End now
                    </button>
                    <button
                        type="button"
                        class="rounded px-3 py-2 text-sm font-medium"
                        :class="endMode === 'schedule' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'"
                        :aria-pressed="endMode === 'schedule'"
                        @click="selectMode('schedule')"
                    >
                        Schedule end
                    </button>
                </div>
            </div>

            <div v-if="endMode === 'schedule'">
                <label for="price-change-end-at" class="mb-1.5 block text-sm font-medium">End date and time</label>
                <input
                    id="price-change-end-at"
                    v-model="endAt"
                    type="datetime-local"
                    :min="minimumScheduleAt"
                    class="h-[40px] w-full rounded border border-gray-300 px-3 text-sm outline-none focus:border-blue-600"
                />
            </div>

            <div>
                <label for="price-change-end-reason" class="mb-1.5 block text-sm font-medium">Reason <span class="font-normal text-gray-500">(optional)</span></label>
                <textarea
                    id="price-change-end-reason"
                    v-model="endReason"
                    rows="3"
                    maxlength="500"
                    placeholder="Why is this price change ending?"
                    class="w-full resize-none rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-600"
                ></textarea>
            </div>

            <div class="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Affected prices will be recalculated from the newest active price change or their base price.
            </div>

            <div v-if="localError" class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {{ localError }}
            </div>

            <div class="flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end">
                <BaseButton
                    label="Cancel"
                    variant="outlined"
                    severity="secondary"
                    :disabled="usePriceChange.endLoading"
                    @click="closeDialog"
                />
                <BaseButton
                    :label="endMode === 'schedule' ? 'Schedule end' : 'End price change'"
                    :icon="usePriceChange.endLoading ? 'fa fa-spinner' : (endMode === 'schedule' ? 'fa fa-calendar-check' : 'fa fa-circle-stop')"
                    :isLoading="usePriceChange.endLoading"
                    severity="danger"
                    :disabled="usePriceChange.endLoading"
                    @click="submitEnd"
                />
            </div>
        </div>
    </Dialog>
</template>
