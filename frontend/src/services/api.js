import axios from "axios";


const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://127.0.0.1:8000" : window.location.origin),
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});


// ==========================================
// JOBS
// ==========================================

export const getJobs = () => {
  return API.get("/jobs/");
};


export const createJob = (job) => API.post("/jobs/", {
  name: job.name,
  compute_required: Number(job.compute_required), memory_required: Number(job.memory_required),
  accelerator_a_required: Number(job.accelerator_a_required ?? 0), accelerator_b_required: Number(job.accelerator_b_required ?? 0),
  priority: Number(job.priority ?? 1), required_node_type: job.required_node_type || null,
});
export const resetWorkspace = () => API.post("/jobs/reset");

export const completeJob = (jobId) => {
  return API.post(
    `/jobs/${jobId}/complete`
  );
};


export const cancelJob = (jobId) => {
  return API.post(
    `/jobs/${jobId}/cancel`
  );
};


// ==========================================
// SCHEDULER STATISTICS
// ==========================================

export const getSchedulerStatistics = () => {
  return API.get("/jobs/statistics");
};


// ==========================================
// HISTORICAL ANALYTICS
// ==========================================

export const getHistoricalAnalytics = () => {
  return API.get(
    "/jobs/historical-analytics"
  );
};


// ==========================================
// WORKLOAD GENERATOR
// ==========================================

export const generateWorkload = (
  count,
  pattern,
  seed
) => {
  return API.post(
    "/jobs/workload/generate",
    null,
    {
      params: {
        count: Number(count),

        pattern,

        seed:
          seed === "" || seed == null
            ? undefined
            : Number(seed),
      },
    }
  );
};


// ==========================================
// STRESS TESTING
// ==========================================

export const runStressTest = (
  count,
  pattern,
  seed
) => {
  return API.post(
    "/jobs/stress-test",
    null,
    {
      params: {
        count: Number(count),

        pattern,

        seed:
          seed === "" || seed == null
            ? undefined
            : Number(seed),
      },
    }
  );
};


// ==========================================
// WORKLOAD STATISTICS
// ==========================================

export const getWorkloadStatistics = () => {
  return API.get(
    "/jobs/workload/statistics"
  );
};


// ==========================================
// SCHEDULING POLICY
// ==========================================

export const getSchedulingPolicy = () => {
  return API.get(
    "/jobs/policy"
  );
};


export const setSchedulingPolicy = (
  policy
) => {
  return API.post(
    "/jobs/policy",
    null,
    {
      params: {
        policy,
      },
    }
  );
};


// ==========================================
// RESOURCES
// ==========================================

export const getResources = () => {
  return API.get(
    "/resources/"
  );
};


// ==========================================
// DEADLOCK
// ==========================================

export const getDeadlockStatus = () => {
  return API.get(
    "/resources/deadlock"
  );
};


// ==========================================
// RESOURCE ANALYTICS
// ==========================================

export const getResourceAnalytics = () => {
  return API.get(
    "/analytics/resources"
  );
};


// ==========================================
// HEALTH CHECK
// ==========================================

export const checkBackend = () => {
  return API.get(
    "/health"
  );
};


export const checkAPI = () => {
  return API.get(
    "/"
  );
};


// ==========================================
// AXIOS ERROR HANDLER
// ==========================================

API.interceptors.response.use(
  (response) => {
    return response;
  },

  (error) => {
    console.error(
      "API Error:",
      error?.response?.data ||
        error.message
    );

    return Promise.reject(error);
  }
);


export default API;

export const getReplayPresets = () => API.get("/replay/presets");
export const listReplayRuns = () => API.get("/replay/runs");
export const createReplayRun = (scenario) => API.post("/replay/runs", scenario);
export const getReplayRun = (runId) => API.get(`/replay/runs/${runId}`);
export const controlReplayRun = (runId, control) => API.post(`/replay/runs/${runId}/control`, control);
export const deleteReplayRun = (runId) => API.delete(`/replay/runs/${runId}`);

export const listBenchmarks = () => API.get("/benchmarks/");
export const createBenchmark = (config) => API.post("/benchmarks/", config);
export const getBenchmark = (id) => API.get(`/benchmarks/${id}`);
export const getBenchmarkEvidence = (id) => API.get(`/benchmarks/${id}/export/json`);
export const benchmarkExportUrl = (id, format) => `${API.defaults.baseURL}/benchmarks/${id}/export/${format}`;

export const getChallengeCatalog = () => API.get("/challenges/catalog");
export const createChallengeRun = (challengeId, options = {}) => API.post("/challenges/runs", { challenge_id: challengeId, ...options });
export const getChallengeRun = (id) => API.get(`/challenges/runs/${id}`);
export const controlChallengeRun = (id, action) => API.post(`/challenges/runs/${id}/control`, { action });
export const challengeExportUrl = (id) => `${API.defaults.baseURL}/challenges/runs/${id}/export`;

API.interceptors.request.use((config) => {
  try {
    const token = sessionStorage.getItem("gpu-api-token");
    if (token && !["get","head","options"].includes((config.method || "get").toLowerCase())) config.headers.Authorization = `Bearer ${token}`;
  } catch { /* Unset token keeps the local demo unchanged. */ }
  return config;
});
