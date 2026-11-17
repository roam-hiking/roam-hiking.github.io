# YouTube descriptions

Placeholders to fill before posting: `PROJECT_URL` (planned: https://roam-hiking.github.io), `ARXIV_URL`,
and the other video's link. Check the chapter times against the final upload.

---

## Movie 1

**Title:** ROAM: Legged robots that hike with common sense (Science Robotics 2026)

**Description:**

How do you get a legged robot to hike a 10 km mountain trail on its own? It can already walk; the hard part is deciding where. ROAM pairs a vision-language model (VLM), which brings common sense from internet-scale data, with locomotion and navigation policies trained in simulation with reinforcement learning.

Every 10 seconds the VLM looks at the camera image, names what is in view (gravel path, grass, rocks, people, signs) and gives each a risk. An open-vocabulary segmentation model turns those labels into a dense risk image several times a second. The image is projected onto an elevation map, and two RL policies use it to choose the way and place every foot.

With ANYmal, the system hiked 10.1 km near Zermatt, stepped around a mannequin lying on the path, stayed out of bushes, and read construction signs that changed where it was allowed to walk.

📄 Paper: Bridging vision-language reasoning and learned control for legged navigation in the wild. Science Robotics (2026)
https://doi.org/10.1126/scirobotics.aee1549
🌐 Project page: PROJECT_URL
📝 arXiv: ARXIV_URL
🎥 A day at Seealpsee (documentary): SEEALPSEE_VIDEO_URL

Authors: Takahiro Miki, Robin Schmid, Manthan Patel, Turcan Tuna, Julia Richter, Julian Nubert, Joonho Lee, Matthias Müller, Marco Hutter
Robotic Systems Lab, ETH Zurich · Apple

Chapters
0:00 Intro
0:24 How ROAM works
1:36 Many environments, no retuning
1:48 Controlled tests: a mannequin on the path, bushes
2:20 Reading signs
3:00 10.1 km hike near Zermatt
5:04 Summary

#robotics #leggedrobots #ANYmal #VLM #reinforcementlearning #ETHZurich #ScienceRobotics

---

## Seealpsee film

**Title:** A day at Seealpsee: hiking with a legged robot

**Description:**

On 25 June 2024 we took ANYmal for a hike: a 2.38 km loop around Seealpsee in the Swiss Alps. The trail has gravel, grass, the lake edge, and cows standing on the path. The film follows the team for the day, from packing the van in Zurich to the robot finding its way along the lake, with the people behind the project explaining how it works.

The robot runs ROAM. A vision-language model looks at the camera image and says what is in view and how risky it is. Segmentation turns that into a risk image, and policies trained in simulation choose where to walk and where to put each foot.

📄 Paper: Bridging vision-language reasoning and learned control for legged navigation in the wild. Science Robotics (2026)
https://doi.org/10.1126/scirobotics.aee1549
🌐 Project page: PROJECT_URL
🎥 Main video (Movie 1): MOVIE1_VIDEO_URL

Authors: Takahiro Miki, Robin Schmid, Manthan Patel, Turcan Tuna, Julia Richter, Julian Nubert, Joonho Lee, Matthias Müller, Marco Hutter
Robotic Systems Lab, ETH Zurich · Apple

#robotics #leggedrobots #ANYmal #hiking #SwissAlps #ETHZurich #ScienceRobotics
