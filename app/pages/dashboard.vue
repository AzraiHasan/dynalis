<template>
  <div class="space-y-4">
    <!-- Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <UCard>
        <div class="flex items-center gap-2">
          <div class="flex-1">
            <div class="text-sm text-gray-500">Total Sites</div>
            <div class="text-2xl font-bold">{{ totalSites }}</div>
          </div>
          <UIcon name="i-lucide-building-2" class="w-8 h-8 text-emerald-500" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center gap-2">
          <div class="flex-1">
            <div class="text-sm text-gray-500">Total Rental (RM mil)</div>
            <div class="text-2xl font-bold">{{ totalRental }}</div>
          </div>
          <UIcon name="i-lucide-wallet" class="w-8 h-8 text-emerald-500" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center gap-2">
          <div class="flex-1">
            <div class="text-sm text-gray-500">Due Payment (RM mil)</div>
            <div class="text-2xl font-bold">{{ duePayment }}</div>
          </div>
          <UIcon name="i-lucide-receipt" class="w-8 h-8 text-red-500" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center gap-2">
          <div class="flex-1">
            <div class="text-sm text-gray-500">Expired Contracts</div>
            <div class="text-2xl font-bold">{{ expiredContracts }}</div>
          </div>
          <UIcon
            name="i-lucide-alert-triangle"
            class="w-8 h-8 text-amber-500"
          />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center gap-2">
          <div class="flex-1">
            <div class="text-sm text-gray-500">Invalid Dates</div>
            <div class="text-2xl font-bold">{{ invalidDates }}</div>
          </div>
          <UIcon name="i-lucide-calendar-x" class="w-8 h-8 text-gray-500" />
        </div>
      </UCard>
    </div>

    <!-- Charts Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Rental Distribution -->
      <UCard>
        <template #header>
          <div class="flex justify-between items-center">
            <h3 class="text-base font-semibold">Rental Distribution</h3>
          </div>
        </template>
        <Bar
          v-if="rentalChartData"
          :data="rentalChartData"
          :options="chartOptions.bar"
          class="h-[300px]"
        />
      </UCard>

      <!-- Contract Expiration Status -->
      <UCard>
        <template #header>
          <div class="flex justify-between items-center">
            <h3 class="text-base font-semibold">Contract Expiration Status</h3>
          </div>
        </template>
        <Doughnut
          v-if="expirationChartData"
          :data="expirationChartData"
          :options="chartOptions.doughnut"
          class="h-[300px]"
        />
      </UCard>

      <!-- Expiration Timeline -->
      <UCard>
        <template #header>
          <div class="flex justify-between items-center">
            <h3 class="text-base font-semibold">Expiration Timeline</h3>
          </div>
        </template>
        <Line
          v-if="expirationTimelineData"
          :data="expirationTimelineData"
          :options="chartOptions.line"
          class="h-[300px]"
        />
      </UCard>

      <!-- Renewal Risk Analysis -->
      <UCard>
        <template #header>
          <div class="flex justify-between items-center">
            <h3 class="text-base font-semibold">Renewal Risk Analysis</h3>
          </div>
        </template>
        <Scatter
          v-if="renewalRiskData"
          :data="renewalRiskData"
          :options="chartOptions.scatter"
          class="h-[300px]"
        />
      </UCard>

      <!-- Payment Flow -->
      <UCard class="lg:col-span-2">
        <template #header>
          <div class="flex justify-between items-center">
            <h3 class="text-base font-semibold">Payment Flow (RM Millions)</h3>
            <UButton
              icon="i-lucide-download"
              color="neutral"
              variant="ghost"
              @click="exportData"
            />
          </div>
        </template>
        <Bar
          v-if="paymentFlowData"
          :data="paymentFlowData"
          :options="chartOptions.paymentFlow"
          class="h-[300px]"
        />
      </UCard>

      <UButton
        label="Back to staging"
        icon="i-lucide-arrow-left"
        @click="handleStaging"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  PointElement,
  LineElement,
  Filler, // Add this import
} from "chart.js";
import { Bar, Doughnut, Line, Scatter } from "vue-chartjs";
import { addMonths, format, differenceInDays } from "date-fns";

// Register ChartJS components
ChartJS.register(
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  PointElement,
  LineElement,
  Filler // Register the Filler plugin
);

interface FileRow {
  [key: string]: string | number | null | undefined; // Updated index signature to include undefined
  "SITE ID"?: string | number | null;
  "EXP DATE"?: string | null; // Made consistent with index signature
  "TOTAL RENTAL (RM)"?: string | number | null; // Made consistent with index signature
  "TOTAL PAYMENT TO PAY (RM)"?: string | number | null; // Made consistent with index signature
  "DEPOSIT (RM)"?: string | number | null; // Made consistent with index signature
}

interface ChartDataset {
  label?: string;
  data: number[] | Array<{ x: number; y: number }>;
  backgroundColor?: string | string[] | ((context: any) => string);
  borderColor?: string | string[];
  borderWidth?: number;
  tension?: number;
  fill?: boolean;
  pointRadius?: number;
  pointHoverRadius?: number;
  hoverOffset?: number;
}

interface ChartData {
  labels?: string[];
  datasets: ChartDataset[];
}

interface PaymentFlowData {
  labels: string[];
  values: number[];
}

// Add this interface specifically for doughnut chart data
interface DoughnutChartData {
  labels?: string[];
  datasets: {
    data: number[];
    backgroundColor?: string[];
    borderColor?: string[];
    borderWidth?: number;
    hoverOffset?: number;
  }[];
}

const router = useRouter();

// Data refs
const fileData = ref<FileRow[]>([]);
const totalSites = ref<number>(0);
const totalRental = ref<string>("0");
const duePayment = ref<string>("0");
const expiredContracts = ref<number>(0);
const invalidDates = ref<number>(0); // Add this line

// Chart data refs
const rentalChartData = ref<ChartData | null>(null);
const expirationChartData = ref<DoughnutChartData | null>(null);
const expirationTimelineData = ref<ChartData | null>(null);
const renewalRiskData = ref<ChartData | null>(null);
const paymentFlowData = ref<ChartData | null>(null);

// Chart options
const chartOptions = {
  bar: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
      },
    },
  },
  doughnut: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "right" as const,
      },
    },
  },
  line: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
      },
    },
  },
  scatter: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        title: {
          display: true,
          text: "Days Until Expiration",
        },
      },
      y: {
        title: {
          display: true,
          text: "Rental Amount (RM)",
        },
      },
    },
  },
  paymentFlow: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  },
};

// Helper functions
const parseCurrency = (value: any): number => {
  if (!value) return 0;
  return parseFloat(value.toString().replace(/[RM,\s]/g, "")) || 0;
};

const getDaysUntilExpiration = (expDate: string): number | null => {
  const date = new Date(expDate);
  if (isNaN(date.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return differenceInDays(date, today);
};

const calculateRentalRanges = (data: FileRow[]): Record<string, number> => {
  const ranges: Record<string, number> = {
    "< RM1,000": 0,
    "RM1,000 - RM2,000": 0,
    "RM2,000 - RM3,000": 0,
    "RM3,000 - RM4,000": 0,
    "> RM4,000": 0,
  };

  data.forEach((row) => {
    const rental = parseCurrency(row["TOTAL RENTAL (RM)"]);
    if (rental < 1000) {
      ranges["< RM1,000"] = (ranges["< RM1,000"] || 0) + 1;
    } else if (rental < 2000) {
      ranges["RM1,000 - RM2,000"] = (ranges["RM1,000 - RM2,000"] || 0) + 1;
    } else if (rental < 3000) {
      ranges["RM2,000 - RM3,000"] = (ranges["RM2,000 - RM3,000"] || 0) + 1;
    } else if (rental < 4000) {
      ranges["RM3,000 - RM4,000"] = (ranges["RM3,000 - RM4,000"] || 0) + 1;
    } else {
      ranges["> RM4,000"] = (ranges["> RM4,000"] || 0) + 1;
    }
  });

  return ranges;
};

const calculateExpirationStatus = (data: FileRow[]): Record<string, number> => {
  const status: Record<string, number> = {
    "Within 30 Days": 0,
    "Within 60 Days": 0,
    "Within 90 Days": 0,
    "Valid > 90 Days": 0,
  };

  data.forEach((row) => {
    const daysUntil = getDaysUntilExpiration(row["EXP DATE"]?.toString() || "");

    if (daysUntil === null) {
      // Skip invalid dates
      return;
    } else if (daysUntil <= 0) {
      // Skip expired contracts as they're shown in the separate card
      return;
    } else if (daysUntil <= 30) {
      status["Within 30 Days"] = (status["Within 30 Days"] || 0) + 1;
    } else if (daysUntil <= 60) {
      status["Within 60 Days"] = (status["Within 60 Days"] || 0) + 1;
    } else if (daysUntil <= 90) {
      status["Within 90 Days"] = (status["Within 90 Days"] || 0) + 1;
    } else {
      status["Valid > 90 Days"] = (status["Valid > 90 Days"] || 0) + 1;
    }
  });

  return status;
};

const calculateExpirationTimeline = (
  data: FileRow[]
): { months: string[]; counts: number[] } => {
  const timeline: Record<string, number> = {};
  const today = new Date();

  // Initialize next 12 months
  for (let i = 0; i < 12; i++) {
    const month = addMonths(today, i);
    timeline[format(month, "MMM yyyy")] = 0;
  }

  data.forEach((row) => {
    const expDate = row["EXP DATE"]?.toString() || "";
    const date = new Date(expDate);
    if (isNaN(date.getTime())) return;

    const monthKey = format(date, "MMM yyyy");
    if (timeline[monthKey] !== undefined) {
      timeline[monthKey]++;
    }
  });

  return {
    months: Object.keys(timeline),
    counts: Object.values(timeline),
  };
};

const calculateRenewalRisk = (
  data: FileRow[]
): Array<{ x: number; y: number }> => {
  return data
    .map((row) => {
      const daysUntil =
        getDaysUntilExpiration(row["EXP DATE"]?.toString() || "") || 0;
      const rental = parseCurrency(row["TOTAL RENTAL (RM)"]);
      return { x: daysUntil, y: rental };
    })
    .filter((point) => !isNaN(point.x) && !isNaN(point.y));
};

const calculatePaymentFlow = (data: FileRow[]): PaymentFlowData => {
  let totalRental = 0;
  let totalPaymentToPay = 0;
  let totalDeposit = 0;

  data.forEach((row) => {
    totalRental += parseCurrency(row["TOTAL RENTAL (RM)"]);
    totalPaymentToPay += parseCurrency(row["TOTAL PAYMENT TO PAY (RM)"]);
    totalDeposit += parseCurrency(row["DEPOSIT (RM)"]);
  });

  return {
    labels: ["Total Rental", "Due Payment", "Deposit"],
    values: [
      totalRental / 1000000,
      totalPaymentToPay / 1000000,
      totalDeposit / 1000000,
    ],
  };
};

const exportData = (): void => {
  alert("Export functionality would be implemented here");
};

onMounted(() => {
  try {
    const stored = localStorage.getItem("uploadedFileData");
    if (!stored) {
      console.log("No data found in localStorage");
      router.push("/dataupload");
      return;
    }

    const data = JSON.parse(stored) as { fileData: FileRow[] };
    console.log("Retrieved data:", data);

    if (
      !data.fileData ||
      !Array.isArray(data.fileData) ||
      data.fileData.length === 0
    ) {
      console.log("Invalid or empty data structure:", data);
      router.push("/dataupload");
      return;
    }

    fileData.value = data.fileData;

    // Set summary statistics
    const sitesData = fileData.value.filter(
      (row) =>
        row["SITE ID"] && row["SITE ID"].toString().toUpperCase() !== "NO ID"
    );
    totalSites.value = sitesData.length;

    let totalRentalValue = 0;
    let totalDuePayment = 0;
    let expiredCount = 0;

    fileData.value.forEach((row) => {
      totalRentalValue += parseCurrency(row["TOTAL RENTAL (RM)"]);
      totalDuePayment += parseCurrency(row["TOTAL PAYMENT TO PAY (RM)"]);

      const daysUntil = getDaysUntilExpiration(
        row["EXP DATE"]?.toString() || ""
      );
      if (daysUntil === null) {
        invalidDates.value++; // Add this line
      } else if (daysUntil <= 0) {
        expiredCount++;
      }
    });

    totalRental.value = (totalRentalValue / 1000000).toFixed(2);
    duePayment.value = (totalDuePayment / 1000000).toFixed(2);
    expiredContracts.value = expiredCount;

    // Prepare rental distribution data
    const rentalRanges = calculateRentalRanges(fileData.value);
    rentalChartData.value = {
      labels: Object.keys(rentalRanges),
      datasets: [
        {
          label: "Number of Sites",
          data: Object.values(rentalRanges),
          backgroundColor: [
            "rgba(16, 185, 129, 0.7)",
            "rgba(52, 211, 153, 0.7)",
            "rgba(20, 184, 166, 0.7)",
            "rgba(6, 182, 212, 0.7)",
            "rgba(14, 165, 233, 0.7)",
          ],
          borderColor: [
            "rgb(5, 150, 105)",
            "rgb(5, 150, 105)",
            "rgb(5, 150, 105)",
            "rgb(5, 150, 105)",
            "rgb(5, 150, 105)",
          ],
          borderWidth: 1,
        },
      ],
    };

    // Prepare expiration data
    const expirationStatus = calculateExpirationStatus(fileData.value);
    expirationChartData.value = {
      labels: Object.keys(expirationStatus),
      datasets: [
        {
          data: Object.values(expirationStatus),
          backgroundColor: [
            "rgb(245, 158, 11)", // Orange for Within 30 Days
            "rgb(252, 211, 77)", // Yellow for Within 60 Days
            "rgb(59, 130, 246)", // Blue for Within 90 Days
            "rgb(16, 185, 129)", // Green for Valid > 90 Days
          ],
          hoverOffset: 4,
          borderWidth: 0,
        },
      ],
    };

    // Prepare expiration timeline data
    const { months, counts } = calculateExpirationTimeline(fileData.value);
    expirationTimelineData.value = {
      labels: months,
      datasets: [
        {
          label: "Contracts Expiring",
          data: counts,
          borderColor: "rgb(59, 130, 246)",
          backgroundColor: "rgba(59, 130, 246, 0.2)",
          tension: 0.1,
          fill: true,
        },
      ],
    };

    // Prepare renewal risk data
    const riskPoints = calculateRenewalRisk(fileData.value);
    renewalRiskData.value = {
      datasets: [
        {
          label: "Sites",
          data: riskPoints,
          backgroundColor: (context: { raw: { x: number } }) => {
            const value = context.raw.x;
            if (value <= 0) return "rgba(239, 68, 68, 0.7)";
            if (value <= 30) return "rgba(245, 158, 11, 0.7)";
            if (value <= 60) return "rgba(252, 211, 77, 0.7)";
            if (value <= 90) return "rgba(59, 130, 246, 0.7)";
            return "rgba(107, 114, 128, 0.7)";
          },
          pointRadius: 5,
          pointHoverRadius: 7,
        },
      ],
    };

    // Prepare payment flow data
    const paymentFlow = calculatePaymentFlow(fileData.value);
    paymentFlowData.value = {
      labels: paymentFlow.labels,
      datasets: [
        {
          label: "Amount (RM Millions)",
          data: paymentFlow.values,
          backgroundColor: [
            "rgba(16, 185, 129, 0.7)", // Emerald
            "rgba(239, 68, 68, 0.7)", // Red
            "rgba(59, 130, 246, 0.7)", // Blue
          ],
          borderColor: [
            "rgb(5, 150, 105)",
            "rgb(220, 38, 38)",
            "rgb(37, 99, 235)",
          ],
          borderWidth: 1,
        },
      ],
    };
  } catch (error) {
    console.error("Error preparing chart data:", error);
    router.push("/dataupload");
  }
});

function handleStaging() {
  router.push("/datastaging");
}
</script>
