import { useEffect, useMemo, useState, type FormEvent } from "react";
import WaveMesh from "./components/ui/wave-mesh";

type Priority = "Low" | "Medium" | "High";
type FilterMode = "all" | "active" | "completed";

interface Task {
  id: number;
  title: string;
  notes: string;
  priority: Priority;
  dueDate: string;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
}

const STORAGE_KEY_TASKS = "taskflow_tasks_v1";
const STORAGE_KEY_ACTIVITY = "taskflow_activity_log_v1";

function toDateKey(dateInput: Date | string): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TASKS);
    return raw ? (JSON.parse(raw) as Task[]) : [];
  } catch {
    return [];
  }
}

function loadActivity(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVITY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [activityLog, setActivityLog] = useState<Record<string, number>>(loadActivity);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{
    label: string;
    count: number;
  } | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [search, setSearch] = useState("");

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [dueDate, setDueDate] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editPriority, setEditPriority] = useState<Priority>("Medium");
  const [editDueDate, setEditDueDate] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ACTIVITY, JSON.stringify(activityLog));
  }, [activityLog]);

  function recordActivity(delta = 1, dateKey = toDateKey(new Date())) {
    setActivityLog((prev) => {
      const nextCount = Math.max(0, (prev[dateKey] || 0) + delta);
      return { ...prev, [dateKey]: nextCount };
    });
  }

  // 84-day (12-week) calendar ending today
  const heatmapDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const totalDays = 84;
    const days: { key: string; label: string; shortLabel: string; count: number }[] = [];

    for (let offset = totalDays - 1; offset >= 0; offset--) {
      const d = new Date(today);
      d.setDate(today.getDate() - offset);
      const key = toDateKey(d);
      const label = d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const shortLabel = d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      days.push({
        key,
        label,
        shortLabel,
        count: activityLog[key] || 0,
      });
    }
    return days;
  }, [activityLog]);

  // 12 columns of 7 days for the heatmap
  const weeks = useMemo(() => {
    const chunked: typeof heatmapDays[] = [];
    for (let i = 0; i < heatmapDays.length; i += 7) {
      chunked.push(heatmapDays.slice(i, i + 7));
    }
    return chunked;
  }, [heatmapDays]);

  // Last 14 days for the Consistency Trend Line Graph
  const trendDays = useMemo(() => heatmapDays.slice(-14), [heatmapDays]);

  const chartGeometry = useMemo(() => {
    const width = 320;
    const height = 112;
    const padX = 10;
    const padY = 14;
    const innerW = width - padX * 2;
    const innerH = height - padY * 2;
    const maxVal = Math.max(4, ...trendDays.map((d) => d.count));

    const points = trendDays.map((d, idx) => {
      const x =
        padX + (trendDays.length > 1 ? (idx / (trendDays.length - 1)) * innerW : innerW / 2);
      const y = padY + innerH - (d.count / maxVal) * innerH;
      return { ...d, x, y };
    });

    const linePath = points
      .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");

    const areaPath =
      points.length > 0
        ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(height - padY).toFixed(
            1
          )} L ${points[0].x.toFixed(1)} ${(height - padY).toFixed(1)} Z`
        : "";

    return { width, height, padX, padY, points, linePath, areaPath, maxVal };
  }, [trendDays]);

  const consistencyStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let currentStreak = 0;
    const cursor = new Date(today);
    while (true) {
      const key = toDateKey(cursor);
      if ((activityLog[key] || 0) > 0) {
        currentStreak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }

    let bestStreak = 0;
    let running = 0;
    for (const day of heatmapDays) {
      if (day.count > 0) {
        running++;
        if (running > bestStreak) bestStreak = running;
      } else {
        running = 0;
      }
    }

    const activeDays14 = trendDays.filter((d) => d.count > 0).length;
    const consistencyPct = Math.round((activeDays14 / trendDays.length) * 100);
    const last7Total = heatmapDays
      .slice(-7)
      .reduce((sum, d) => sum + d.count, 0);

    return { currentStreak, bestStreak, consistencyPct, last7Total };
  }, [activityLog, heatmapDays, trendDays]);

  const activeCount = useMemo(
    () => tasks.filter((t) => !t.completed).length,
    [tasks]
  );
  const hasCompleted = useMemo(
    () => tasks.some((t) => t.completed),
    [tasks]
  );

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const statusMatch =
        filter === "all" ||
        (filter === "active" && !task.completed) ||
        (filter === "completed" && task.completed);
      const searchMatch = task.title
        .toLowerCase()
        .includes(search.trim().toLowerCase());
      const dayMatch =
        !selectedDay ||
        toDateKey(task.createdAt) === selectedDay ||
        (task.completedAt && toDateKey(task.completedAt) === selectedDay);
      return statusMatch && searchMatch && dayMatch;
    });
  }, [tasks, filter, search, selectedDay]);

  function handleAddTask(e: FormEvent) {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    const nowIso = new Date().toISOString();
    const newTask: Task = {
      id: Date.now(),
      title: clean,
      notes: notes.trim(),
      priority,
      dueDate,
      completed: false,
      createdAt: nowIso,
    };
    setTasks((prev) => [newTask, ...prev]);
    recordActivity(1, toDateKey(nowIso));
    setTitle("");
    setNotes("");
    setPriority("Medium");
    setDueDate("");
  }

  function startEdit(task: Task) {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditNotes(task.notes);
    setEditPriority(task.priority);
    setEditDueDate(task.dueDate);
  }

  function saveEdit(e: FormEvent, id: number) {
    e.preventDefault();
    const clean = editTitle.trim();
    if (!clean) return;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              title: clean,
              notes: editNotes.trim(),
              priority: editPriority,
              dueDate: editDueDate,
            }
          : t
      )
    );
    setEditingId(null);
  }

  function toggleComplete(id: number) {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;
    const nextCompleted = !target.completed;
    const nowIso = new Date().toISOString();

    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              completed: nextCompleted,
              completedAt: nextCompleted ? nowIso : undefined,
            }
          : t
      )
    );

    recordActivity(nextCompleted ? 1 : -1, toDateKey(nowIso));
  }

  function deleteTask(id: number) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (editingId === id) setEditingId(null);
  }

  function clearCompleted() {
    setTasks((prev) => prev.filter((t) => !t.completed));
  }

  function getCellColor(count: number) {
    if (count <= 0) return "bg-white/[0.04] border-white/[0.06]";
    if (count === 1) return "bg-[#c9d6ea]/25 border-[#c9d6ea]/35";
    if (count <= 3) return "bg-[#c9d6ea]/55 border-[#c9d6ea]/65";
    return "bg-[#f0b37a] border-[#f0b37a]";
  }

  const priorityBadge: Record<Priority, string> = {
    High: "border-rose-400/25 bg-rose-500/10 text-rose-300",
    Medium: "border-amber-300/25 bg-amber-400/10 text-[#f0b37a]",
    Low: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
  };

  return (
    <WaveMesh
      colors={["#06070a", "#c9d6ea", "#f0b37a"]}
      crests={false}
      className="min-h-screen w-full px-4 py-10 text-white sm:px-6"
    >
      <div className="mx-auto max-w-4xl">
        {/* Hero Header */}
        <header className="mb-8 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/50">
            TaskFlow · Workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Every task in focus, in one view.
          </h1>
          <p className="mt-2 text-sm text-[#c9d6ea]/70">
            Move your cursor across the horizon or click anywhere to ripple the mesh.
          </p>
        </header>

        {/* Side-by-Side Activity Heatmap & Consistency Trend Graph */}
        <section className="mb-6 rounded-2xl border border-white/10 bg-[#0b0d13]/75 p-5 shadow-2xl backdrop-blur-md">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/55">
                Activity Heatmap & Consistency Graph
              </h2>
              <p className="mt-1 text-xs text-white/45">
                {selectedDay
                  ? `Showing tasks logged on ${selectedDay}`
                  : "Click any square or graph node to filter tasks for that date"}
              </p>
            </div>

            {selectedDay && (
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="rounded-lg border border-white/15 px-2.5 py-1 font-mono text-[11px] text-[#f0b37a] transition hover:bg-white/5"
              >
                Reset date filter
              </button>
            )}
          </div>

          {/* Summary KPI Row */}
          <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <p className="font-mono text-[10px] uppercase tracking-wider text-white/45">
                Current Streak
              </p>
              <p className="mt-0.5 text-lg font-semibold text-white">
                {consistencyStats.currentStreak}{" "}
                <span className="text-xs font-normal text-white/50">days</span>
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <p className="font-mono text-[10px] uppercase tracking-wider text-white/45">
                Best Streak
              </p>
              <p className="mt-0.5 text-lg font-semibold text-[#f0b37a]">
                {consistencyStats.bestStreak}{" "}
                <span className="text-xs font-normal text-white/50">days</span>
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <p className="font-mono text-[10px] uppercase tracking-wider text-white/45">
                14-Day Rate
              </p>
              <p className="mt-0.5 text-lg font-semibold text-[#c9d6ea]">
                {consistencyStats.consistencyPct}%
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <p className="font-mono text-[10px] uppercase tracking-wider text-white/45">
                Last 7 Days
              </p>
              <p className="mt-0.5 text-lg font-semibold text-white">
                {consistencyStats.last7Total}{" "}
                <span className="text-xs font-normal text-white/50">actions</span>
              </p>
            </div>
          </div>

          {/* Side-by-Side Grid: Left = Heatmap, Right = Consistency Line Graph */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Left Panel: 12-Week Heatmap */}
            <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-white/50">
                  12-Week Heatmap
                </span>
                <div className="flex items-center gap-1 font-mono text-[10px] text-white/40">
                  <span>Less</span>
                  <span className="h-2.5 w-2.5 rounded-[2px] border border-white/[0.06] bg-white/[0.04]" />
                  <span className="h-2.5 w-2.5 rounded-[2px] border border-[#c9d6ea]/35 bg-[#c9d6ea]/25" />
                  <span className="h-2.5 w-2.5 rounded-[2px] border border-[#c9d6ea]/65 bg-[#c9d6ea]/55" />
                  <span className="h-2.5 w-2.5 rounded-[2px] border border-[#f0b37a] bg-[#f0b37a]" />
                  <span>More</span>
                </div>
              </div>

              <div className="flex items-center justify-center overflow-x-auto py-1">
                <div className="inline-grid grid-flow-col grid-rows-7 gap-1.5">
                  {weeks.flatMap((week) =>
                    week.map((day) => {
                      const isSelected = selectedDay === day.key;
                      return (
                        <button
                          key={day.key}
                          type="button"
                          title={`${day.label}: ${day.count} ${
                            day.count === 1 ? "action" : "actions"
                          }`}
                          onClick={() =>
                            setSelectedDay((prev) =>
                              prev === day.key ? null : day.key
                            )
                          }
                          className={`h-3.5 w-3.5 rounded-[3px] border transition hover:scale-125 ${getCellColor(
                            day.count
                          )} ${isSelected ? "ring-2 ring-white" : ""}`}
                        />
                      );
                    })
                  )}
                </div>
              </div>

              <p className="mt-2 text-center font-mono text-[10px] text-white/40">
                84 days · Hover any square for daily count
              </p>
            </div>

            {/* Right Panel: 14-Day Consistency Trend Graph */}
            <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-white/50">
                  14-Day Consistency Curve
                </span>
                <span className="font-mono text-[11px] text-[#f0b37a]">
                  {hoveredPoint
                    ? `${hoveredPoint.label}: ${hoveredPoint.count}`
                    : `Peak: ${chartGeometry.maxVal}/day`}
                </span>
              </div>

              <svg
                viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
                className="h-32 w-full overflow-visible"
                role="img"
                aria-label="14-day task consistency line graph"
              >
                <defs>
                  <linearGradient id="consistencyArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f0b37a" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#f0b37a" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal guide lines */}
                {[0.25, 0.5, 0.75, 1].map((ratio) => {
                  const y =
                    chartGeometry.padY +
                    (chartGeometry.height - chartGeometry.padY * 2) * (1 - ratio);
                  return (
                    <line
                      key={ratio}
                      x1={chartGeometry.padX}
                      x2={chartGeometry.width - chartGeometry.padX}
                      y1={y}
                      y2={y}
                      stroke="rgba(255,255,255,0.07)"
                      strokeDasharray="3 3"
                    />
                  );
                })}

                {/* Area under curve */}
                {chartGeometry.areaPath && (
                  <path d={chartGeometry.areaPath} fill="url(#consistencyArea)" />
                )}

                {/* Trend line */}
                {chartGeometry.linePath && (
                  <path
                    d={chartGeometry.linePath}
                    fill="none"
                    stroke="#f0b37a"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Interactive data nodes */}
                {chartGeometry.points.map((pt) => {
                  const isSelected = selectedDay === pt.key;
                  return (
                    <g
                      key={pt.key}
                      className="cursor-pointer"
                      onMouseEnter={() =>
                        setHoveredPoint({ label: pt.shortLabel, count: pt.count })
                      }
                      onMouseLeave={() => setHoveredPoint(null)}
                      onClick={() =>
                        setSelectedDay((prev) =>
                          prev === pt.key ? null : pt.key
                        )
                      }
                    >
                      <circle cx={pt.x} cy={pt.y} r="9" fill="transparent" />
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isSelected ? 4.5 : pt.count > 0 ? 3 : 2}
                        fill={
                          isSelected
                            ? "#ffffff"
                            : pt.count > 0
                            ? "#f0b37a"
                            : "#c9d6ea"
                        }
                        fillOpacity={pt.count > 0 || isSelected ? 1 : 0.35}
                      />
                    </g>
                  );
                })}
              </svg>

              <div className="mt-1 flex justify-between font-mono text-[10px] text-white/40">
                <span>{trendDays[0]?.shortLabel}</span>
                <span>{trendDays[Math.floor(trendDays.length / 2)]?.shortLabel}</span>
                <span>Today</span>
              </div>
            </div>
          </div>
        </section>

        {/* Main Task Workspace */}
        <div className="mx-auto max-w-2xl">
          {/* Create Task Card */}
          <form
            onSubmit={handleAddTask}
            className="mb-6 rounded-2xl border border-white/10 bg-[#0b0d13]/75 p-5 shadow-2xl backdrop-blur-md"
          >
            <div className="mb-3">
              <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-white/55">
                Task Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder-white/35 outline-none transition focus:border-[#c9d6ea]/50 focus:bg-white/[0.06]"
              />
            </div>

            <div className="mb-3">
              <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-white/55">
                Description / Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add details, links, or sub-steps..."
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm text-white placeholder-white/35 outline-none transition focus:border-[#c9d6ea]/50 focus:bg-white/[0.06]"
              />
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-white/55">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="w-full rounded-xl border border-white/10 bg-[#0f121a] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-[#c9d6ea]/50"
                >
                  <option value="Low">Low Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="High">High Priority</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-white/55">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white outline-none transition [color-scheme:dark] focus:border-[#c9d6ea]/50"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-[#c9d6ea] px-4 py-2.5 text-sm font-semibold text-[#06070a] transition hover:bg-white"
            >
              + Add Task
            </button>
          </form>

          {/* Search & Filter Controls */}
          <div className="mb-4 space-y-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="w-full rounded-xl border border-white/10 bg-[#0b0d13]/75 px-4 py-2.5 text-sm text-white placeholder-white/35 shadow-lg backdrop-blur-md outline-none transition focus:border-[#c9d6ea]/50"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex rounded-xl border border-white/10 bg-[#0b0d13]/75 p-1 backdrop-blur-md">
                {(["all", "active", "completed"] as FilterMode[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilter(tab)}
                    className={`rounded-lg px-3 py-1 text-xs font-medium capitalize transition ${
                      filter === tab
                        ? "bg-[#c9d6ea] font-semibold text-[#06070a]"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 font-mono text-xs text-white/55">
                <span>
                  {activeCount} {activeCount === 1 ? "task" : "tasks"} left
                </span>
                {hasCompleted && (
                  <button
                    type="button"
                    onClick={clearCompleted}
                    className="text-[#f0b37a] transition hover:underline"
                  >
                    Clear completed
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Task List */}
          {filteredTasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-[#0b0d13]/60 p-10 text-center backdrop-blur-md">
              <h3 className="text-sm font-medium text-white/85">No tasks yet</h3>
              <p className="mt-1 text-xs text-white/45">
                Add a task above to start organizing your workflow.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) =>
                editingId === task.id ? (
                  <form
                    key={task.id}
                    onSubmit={(e) => saveEdit(e, task.id)}
                    className="space-y-3 rounded-xl border border-[#f0b37a]/50 bg-[#0b0d13]/85 p-4 shadow-xl backdrop-blur-md"
                  >
                    <input
                      type="text"
                      required
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none"
                    />
                    <textarea
                      rows={2}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none"
                    />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <select
                        value={editPriority}
                        onChange={(e) =>
                          setEditPriority(e.target.value as Priority)
                        }
                        className="rounded-lg border border-white/15 bg-[#0f121a] px-3 py-2 text-sm text-white outline-none"
                      >
                        <option value="Low">Low Priority</option>
                        <option value="Medium">Medium Priority</option>
                        <option value="High">High Priority</option>
                      </select>
                      <input
                        type="date"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                        className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none [color-scheme:dark]"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/75 hover:bg-white/5"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="rounded-lg bg-[#c9d6ea] px-3 py-1.5 text-xs font-semibold text-[#06070a]"
                      >
                        Save Changes
                      </button>
                    </div>
                  </form>
                ) : (
                  <div
                    key={task.id}
                    className={`flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-[#0b0d13]/75 p-4 shadow-lg backdrop-blur-md transition hover:border-white/20 ${
                      task.completed ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => toggleComplete(task.id)}
                        className="mt-1 h-4 w-4 cursor-pointer accent-[#c9d6ea]"
                      />
                      <div>
                        <p
                          className={`text-sm font-medium text-white ${
                            task.completed ? "line-through text-white/50" : ""
                          }`}
                        >
                          {task.title}
                        </p>
                        {task.notes && (
                          <p className="mt-1 whitespace-pre-wrap text-xs text-white/60">
                            {task.notes}
                          </p>
                        )}
                        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
                          <span
                            className={`rounded-full border px-2.5 py-0.5 font-medium ${
                              priorityBadge[task.priority]
                            }`}
                          >
                            {task.priority}
                          </span>
                          {task.dueDate && (
                            <span className="font-mono text-white/45">
                              Due {task.dueDate}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(task)}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-white/65 transition hover:bg-white/10 hover:text-white"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTask(task.id)}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-rose-400/85 transition hover:bg-rose-500/15 hover:text-rose-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </WaveMesh>
  );
}
