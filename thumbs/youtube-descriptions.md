# YouTube descriptions

Placeholders to fill before posting: `ARXIV_URL`
and the other video's link (both video links are filled in). Chapter times were read from frames taken every 4–5 s, so check them against the final upload.
YouTube needs the first chapter at 0:00 and each chapter to be at least 10 s long.

---

## Movie 1 (5:36)

**Title:** ROAM: Legged robots that hike with common sense | Science Robotics 2026

**Description:**

Vision-language models give legged robots the common sense to hike kilometers on their own, on alpine trails and in towns.

ROAM (Robust Open-world Autonomous Mobility) pairs a vision-language model (VLM) with locomotion and navigation policies trained in simulation with reinforcement learning. The VLM looks at the camera image, names what it sees (gravel path, grass, rocks, people, signs) and gives each one a risk. Segmentation turns that into a dense risk image, which is projected onto an elevation map. Two RL policies use it to pick the way and place every foot. ANYmal hiked 10.1 km near Zermatt with about 1,200 m of elevation change. It also stepped around a mannequin lying on the path, stayed out of bushes, and followed construction signs.

📄 Paper: Bridging vision-language reasoning and learned control for legged navigation in the wild. Science Robotics (2026)
https://doi.org/10.1126/scirobotics.aee1549
🌐 Project page: https://roam-hiking.github.io
📝 arXiv: ARXIV_URL
🎥 A day at Seealpsee (documentary): https://youtu.be/wrbAq2HXE8E

Authors: Takahiro Miki, Robin Schmid, Manthan Patel, Turcan Tuna, Julia Richter, Julian Nubert, Joonho Lee, Matthias Müller, Marco Hutter
Robotic Systems Lab, ETH Zurich · Apple

Abstract
Autonomous navigation in diverse real-world environments remains one of the greatest challenges in robotics. It demands both robust low-level motion control to handle diverse terrain and high-level reasoning to interpret environmental cues. We present ROAM (Robust Open-world Autonomous Mobility), a system that enables legged robots to perform kilometer-scale navigation in complex alpine and urban settings. ROAM combines the world knowledge of a Vision-Language Model (VLM), pre-trained on internet-scale data, with robust locomotion and local planning policies learned in simulation via reinforcement learning (RL). The VLM provides common-sense reasoning and semantic interpretation of the scene, assessing risks, interpreting signs, and producing semantic labels with associated navigation costs. An open-vocabulary segmentation module converts these labels into a dense, real-time risk map, which conditions two pre-trained RL policies responsible for agile locomotion and local navigation, effectively coupling high-level VLM reasoning with low-level physical control. Real-world experiments showed the system's ability to autonomously navigate a wide range of complex real-world environments. The robot completes kilometer-long hikes with minimal intervention, interprets signs to avoid danger, and evaluates its environment to identify safe areas on which to step. This work represents a step toward the reliable deployment of systems in unstructured environments. However, it also underscores the challenges that remain in VLM reliability and spatial reasoning, indicating that foundational models are a crucial component but not yet a complete solution for navigation in the wild.

Chapters
0:00 Intro: alpine trails, cities, indoors
0:28 How ROAM works: asking the VLM about the camera image
0:48 Labels → risk image
1:04 Elevation map and navigation policy
1:36 Many environments, no retuning
1:48 Test: a mannequin lying on the path
2:00 Test: staying out of a bush
2:12 Test: a "Do Not Walk on Path" sign
2:40 Test: "Merge Back To Path" sign
3:00 10.1 km hike near Zermatt: the route
3:24 Start at Gornergrat, rocky trail
3:40 Lake edge: why semantics beat depth alone
4:00 Gravel paths and 30% slopes
4:24 Forest, railway track and town
5:00 Arrival at the cable car station
5:04 Summary

#robotics #leggedrobots #ANYmal #VLM #reinforcementlearning #ETHZurich #ScienceRobotics

---

## Seealpsee film (5:21)

**Title:** A day at Seealpsee: hiking with a legged robot

**Description:**

A behind-the-scenes day with ANYmal on a 2.4 km hike around Seealpsee in the Swiss Alps. Gravel paths, grass, the lake edge and cows on the trail.

On 25 June 2024 the team drove ANYmal from Zurich to Seealpsee for a hike around the lake. The film follows the day, from packing the van to the robot finding its way along the shore past cows and hikers. The researchers explain how it works along the way. The robot runs ROAM: a vision-language model looks at the camera image and says what is in view and how risky it is. Segmentation turns that into a risk image, and policies trained in simulation choose where to walk and where to put each foot.

📄 Paper: Bridging vision-language reasoning and learned control for legged navigation in the wild. Science Robotics (2026)
https://doi.org/10.1126/scirobotics.aee1549
🌐 Project page: https://roam-hiking.github.io
📝 arXiv: ARXIV_URL
🎥 Main video (Movie 1): https://youtu.be/xcqVpbgklD4

Authors: Takahiro Miki, Robin Schmid, Manthan Patel, Turcan Tuna, Julia Richter, Julian Nubert, Joonho Lee, Matthias Müller, Marco Hutter
Robotic Systems Lab, ETH Zurich · Apple

Abstract
Autonomous navigation in diverse real-world environments remains one of the greatest challenges in robotics. It demands both robust low-level motion control to handle diverse terrain and high-level reasoning to interpret environmental cues. We present ROAM (Robust Open-world Autonomous Mobility), a system that enables legged robots to perform kilometer-scale navigation in complex alpine and urban settings. ROAM combines the world knowledge of a Vision-Language Model (VLM), pre-trained on internet-scale data, with robust locomotion and local planning policies learned in simulation via reinforcement learning (RL). The VLM provides common-sense reasoning and semantic interpretation of the scene, assessing risks, interpreting signs, and producing semantic labels with associated navigation costs. An open-vocabulary segmentation module converts these labels into a dense, real-time risk map, which conditions two pre-trained RL policies responsible for agile locomotion and local navigation, effectively coupling high-level VLM reasoning with low-level physical control. Real-world experiments showed the system's ability to autonomously navigate a wide range of complex real-world environments. The robot completes kilometer-long hikes with minimal intervention, interprets signs to avoid danger, and evaluates its environment to identify safe areas on which to step. This work represents a step toward the reliable deployment of systems in unstructured environments. However, it also underscores the challenges that remain in VLM reliability and spatial reasoning, indicating that foundational models are a crucial component but not yet a complete solution for navigation in the wild.

Chapters
0:00 Packing up in Zurich
0:25 Arriving at Seealpsee
0:40 Meet the team
1:10 The route: a 2.4 km loop around the lake
1:20 Why take a robot hiking?
1:40 How it sees: sensors, elevation map and risk
2:00 Cows on the trail
2:20 Asking the VLM: "Where is the safest way to go?"
2:40 Out on the trail
2:50 Field fixes
3:15 Along the lake shore
4:20 More cows, more hikers
4:55 Looking back on the day

#robotics #leggedrobots #ANYmal #hiking #SwissAlps #ETHZurich #ScienceRobotics
