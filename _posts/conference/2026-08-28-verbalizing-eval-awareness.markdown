---
layout: post
title: "Training LLMs to Verbalize Evaluation Awareness"
date:   2026-08-27 09:00:00
image: /papers/verbalizing-eval-awareness/figure1.png
categories: conference
author: "Usman Anwar"
authors: "<strong>Usman Anwar</strong>, Sahar Abdelnabi, David Krueger"
venue: "Under review"
pdf: /papers/verbalizing-eval-awareness/paper.pdf
---
Evaluation awareness (EA) can cause large language models to behave differently during audits than in deployment, yet measuring and accounting for EA remains challenging. We introduce verbalization training (VT), a method for making LLMs less reticent about verbalizing evaluation awareness while avoiding supervising the latent belief itself, by using the model's own spontaneous verbalizations as evidence of when awareness is present and rewarding only the verbalization span. Across three frontier models, VT increases verbalized EA by 2.4-2.9x on average and transfers to held-out agentic settings, while measured latent EA and behavior remain largely stable.
