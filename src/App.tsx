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
  createdAt: string;
}

const STORAGE_KEY_TASKS = "taskflow_tasks_v1";

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TASKS);
    return raw ? (JSON.parse(raw) as Task[]) : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
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
      return statusMatch && searchMatch;
    });
  }, [tasks, filter, search]);

  function handleAddTask(e: FormEvent) {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    const newTask: Task = {
      id: Date.now(),
      title: clean,
      notes: notes.trim(),
      priority,
      dueDate,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [newTask, ...prev]);
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
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  }

  function deleteTask(id: number) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (editingId === id) setEditingId(null);
  }

  function clearCompleted() {
    setTasks((prev) => prev.filter((t) => !t.completed));
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
      <div className="mx-auto max-w-2xl">
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
                      onChange={(e) => setEditPriority(e.target.value as Priority)}
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
    </WaveMesh>
  );
}
