"""
Round Robin Scheduling Algorithm - Flask Backend
================================================
This file implements the Round Robin CPU scheduling algorithm as a REST API.
The algorithm cycles through processes in a queue, giving each a fixed time slice (quantum).

How to Run:
    pip install flask flask-cors
    python app.py
    Server runs at: http://localhost:5000
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from collections import deque
import os

# Initialize Flask app
app = Flask(__name__, static_folder=os.path.dirname(os.path.abspath(__file__)))

# Enable CORS so the frontend (running on a different port) can call this API
CORS(app)


def round_robin(processes, time_quantum):
    """
    Implements the Round Robin CPU Scheduling Algorithm.

    Args:
        processes (list): List of dicts with 'name' and 'burst_time' keys.
        time_quantum (int): Time slice allocated to each process per turn.

    Returns:
        dict: Contains execution_order (Gantt chart data), waiting_time,
              turnaround_time, avg_waiting_time, avg_turnaround_time.
    """

    n = len(processes)

    # Copy burst times so we don't modify original data
    remaining_time = [p["burst_time"] for p in processes]

    # Arrays to store computed results
    waiting_time = [0] * n
    turnaround_time = [0] * n
    completion_time = [0] * n

    # Gantt chart: list of {"name": process_name, "start": t, "end": t+slice}
    gantt_chart = []

    # Queue holds indices of processes ready to execute
    # We use a deque for O(1) pops from the front and appends to the back
    queue = deque()

    current_time = 0
    completed = 0           # Count of fully completed processes
    visited = [False] * n   # Track which processes have been enqueued

    # Enqueue the first process (assuming processes arrive at time 0)
    queue.append(0)
    visited[0] = True

    # Keep scheduling until all processes complete
    while completed < n:

        if not queue:
            # CPU is idle — advance time to next arriving process
            # (in this simplified version, all arrive at t=0, so this handles edge cases)
            current_time += 1
            for i in range(n):
                if not visited[i] and remaining_time[i] > 0:
                    queue.append(i)
                    visited[i] = True
            continue

        idx = queue.popleft()   # Pick the next process from the front of the queue

        # Determine how long this process runs this turn
        run_time = min(time_quantum, remaining_time[idx])

        # Record this execution slice in the Gantt chart
        gantt_chart.append({
            "name": processes[idx]["name"],
            "start": current_time,
            "end": current_time + run_time
        })

        # Advance the clock
        current_time += run_time
        remaining_time[idx] -= run_time

        # Check if any new processes "arrive" — in a static scenario all start at 0,
        # but we enqueue them lazily as the clock advances
        for i in range(n):
            if not visited[i] and remaining_time[i] > 0:
                queue.append(i)
                visited[i] = True

        if remaining_time[idx] == 0:
            # Process has finished execution
            completed += 1
            completion_time[idx] = current_time
        else:
            # Process still has burst left — re-enqueue it at the back
            queue.append(idx)

    # --- Calculate Waiting Time and Turnaround Time ---
    # Turnaround Time = Completion Time - Arrival Time (arrival = 0 for all)
    # Waiting Time    = Turnaround Time - Burst Time
    for i in range(n):
        turnaround_time[i] = completion_time[i]                    # arrival=0
        waiting_time[i]    = turnaround_time[i] - processes[i]["burst_time"]

    avg_waiting_time    = sum(waiting_time)    / n
    avg_turnaround_time = sum(turnaround_time) / n

    # Build a clean results list for each process
    results = []
    for i in range(n):
        results.append({
            "name"           : processes[i]["name"],
            "burst_time"     : processes[i]["burst_time"],
            "waiting_time"   : waiting_time[i],
            "turnaround_time": turnaround_time[i],
            "completion_time": completion_time[i]
        })

    return {
        "gantt_chart"         : gantt_chart,
        "results"             : results,
        "avg_waiting_time"    : round(avg_waiting_time,    2),
        "avg_turnaround_time" : round(avg_turnaround_time, 2)
    }


@app.route("/schedule", methods=["POST"])
def schedule():
    """
    API Endpoint: POST /schedule
    ----------------------------
    Accepts JSON body:
        {
            "processes": [{"name": "P1", "burst_time": 5}, ...],
            "time_quantum": 2
        }

    Returns JSON with scheduling results.
    """
    data = request.get_json()

    # --- Input Validation ---
    if not data:
        return jsonify({"error": "No data provided"}), 400

    processes    = data.get("processes", [])
    time_quantum = data.get("time_quantum", 0)

    if not processes:
        return jsonify({"error": "No processes provided"}), 400

    if not isinstance(time_quantum, int) or time_quantum <= 0:
        return jsonify({"error": "Time quantum must be a positive integer"}), 400

    for p in processes:
        if not p.get("name") or not isinstance(p.get("burst_time"), int) or p["burst_time"] <= 0:
            return jsonify({"error": f"Invalid process data for: {p}"}), 400

    # --- Run the Algorithm ---
    output = round_robin(processes, time_quantum)

    return jsonify(output), 200


@app.route("/health", methods=["GET"])
def health():
    """Simple health-check endpoint so frontend can verify the server is running."""
    return jsonify({"status": "ok", "message": "Round Robin Scheduler API is running"}), 200


@app.route("/", methods=["GET"])
def index():
    """Serve the main dashboard page."""
    return send_from_directory(os.path.dirname(os.path.abspath(__file__)), "index.html")


@app.route("/<path:filename>", methods=["GET"])
def serve_static(filename):
    """Serve CSS, JS, and other static files."""
    return send_from_directory(os.path.dirname(os.path.abspath(__file__)), filename)


if __name__ == "__main__":
    print("=" * 55)
    print("  Round Robin Scheduler API — Flask Server")
    print("  Running at: http://localhost:5000")
    print("  Endpoints:")
    print("    GET  /health   — Health check")
    print("    POST /schedule — Run Round Robin algorithm")
    print("=" * 55)
    app.run(debug=True, port=5000)
