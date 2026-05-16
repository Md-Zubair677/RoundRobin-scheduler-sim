# RoundRobin Scheduler Simulator

Interactive Round Robin scheduling demo with a web frontend, Python Flask backend, and CloudSim Java example.

## Overview

This project demonstrates the Round Robin CPU scheduling algorithm across three layers:

- **Frontend**: `index.html`, `style.css`, and `script.js` provide a responsive UI for adding processes and visualizing a Gantt chart.
- **Backend**: `app.py` is a Flask API that computes completion, waiting, and turnaround times.
- **CloudSim**: `cloudsim/modules/cloudsim-examples/src/main/java/org/cloudbus/cloudsim/examples/RoundRobinExample.java` maps the same scheduling concept to a cloud simulation.

## Features

- Add multiple processes with custom burst times
- Configure the time quantum for Round Robin scheduling
- Display a Gantt chart for execution order
- Show per-process waiting time, turnaround time, and completion time
- Compare browser scheduling with a professional CloudSim example

## How to Run

1. Start the Python backend:

```powershell
python app.py
```

2. Open the frontend:

- Double-click `index.html`, or
- Run `start "C:\cc mini rr\index.html"`

3. Run the CloudSim example after building the Java project with Maven:

```powershell
cd cloudsim
maven\apache-maven-3.9.6\bin\mvn.cmd clean package
java -cp "modules\cloudsim-examples\target\cloudsim-examples-7.0.1.jar;modules\cloudsim\target\cloudsim-7.0.1.jar" org.cloudbus.cloudsim.examples.RoundRobinExample
```

## Repository Structure

- `app.py` — Flask backend and Round Robin algorithm implementation
- `index.html` — Web UI
- `script.js` — Frontend interaction and API integration
- `style.css` — UI styling
- `PROJECT_EXPLANATION.txt` — Plain-language project explanation
- `cloudsim/` — CloudSim toolkit and Java examples
- `maven/` — Local Maven distribution

## Technologies

- HTML, CSS, JavaScript
- Python with Flask
- Java and Apache Maven
- CloudSim 7.0.1

## Notes

- The web UI sends scheduling data to the Flask backend via `POST /schedule`.
- The CloudSim example uses a single VM with `CloudletSchedulerTimeShared` to simulate Round Robin behavior.
- If you want to run CloudSim locally, install JDK 21 and build the CloudSim module with Maven.
