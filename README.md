# 🚚 AI Delivery Route Optimizer

A production-quality browser-based application that simulates how delivery companies (Amazon, Swiggy, FedEx) optimize delivery routes using the **Travelling Salesman Problem (TSP)**.

---

## 📁 Project Structure

```
ai-route-optimizer/
│
├── index.html          ← Main HTML (entry point)
│
├── css/
│   └── style.css       ← Cyberpunk dark theme, animations, layout
│
├── js/
│   └── script.js       ← All logic: TSP, Haversine, simulation, map
│
├── assets/             ← (Reserved for future icons/images)
│
└── README.md           ← This file
```

---

## 🚀 How to Run

No server needed. Just open in browser:

```
Double-click index.html
```

Or via terminal:
```bash
# macOS
open index.html

# Linux
xdg-open index.html

# VS Code Live Server (recommended)
Right-click index.html → Open with Live Server
```

---

## 🧠 Algorithms Used

| Algorithm        | Purpose                        | Complexity |
|-----------------|-------------------------------|------------|
| Nearest Neighbor | TSP heuristic (greedy)        | O(N²)      |
| Haversine        | Real-world distance (km)      | O(1)       |
| Fisher-Yates     | Random route shuffle          | O(N)       |

---

## ✨ Features

- 🗺 Interactive real-world map (Leaflet.js + OpenStreetMap)
- 📍 Click to add Warehouse + Delivery Stops
- 🧠 TSP Nearest Neighbor optimization
- 🔴🟢 Route comparison (Optimized vs Random)
- 🏍 Animated delivery agent simulation
- 📊 Live statistics: distance saved, compute time
- 🖥 Cyberpunk dark UI with neon glowing routes

---

## 📦 Tech Stack

- HTML5, CSS3, Vanilla JavaScript (no frameworks)
- [Leaflet.js](https://leafletjs.com/) — interactive maps
- [OpenStreetMap](https://www.openstreetmap.org/) — free map tiles
- [Font Awesome](https://fontawesome.com/) — icons
- [Google Fonts](https://fonts.google.com/) — Orbitron, Rajdhani

---

## 🎓 Viva Notes

**What is TSP?**  
Given N cities, find the shortest route visiting each exactly once and returning to start.

**Why NP-Hard?**  
(N-1)!/2 possible routes. 20 cities = ~60 quadrillion combinations.

**Why Nearest Neighbor?**  
Greedy O(N²) heuristic — fast, practical, ~20% above optimal. Used in real logistics.
