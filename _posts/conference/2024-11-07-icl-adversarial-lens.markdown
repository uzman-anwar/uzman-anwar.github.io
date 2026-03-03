---
layout: post
title: "Understanding In-Context Learning of Linear Models in Transformers Through an Adversarial Lens"
date:   2024-11-07 14:30:00
image: /images/404.jpg
categories: conference
author: "Usman Anwar"
authors: "<strong>Usman Anwar</strong>, Johannes Von Oswald, Louis Kirsch, David Krueger, Spencer Frei"
venue: "Transactions on Machine Learning Research (Featured Certification, 2025)"
arxiv: https://arxiv.org/abs/2411.05189
---
We study how in-context learners built from transformers behave when faced with adversarial hijacking attacks. We find both linear and GPT-2 style transformers are surprisingly brittle, but adversarial training during pretraining or finetuning substantially improves robustness and generalizes to stronger attacks. By comparing across architectures and to classical algorithms for fitting linear models, we show that the learned in-context learning procedures differ qualitatively, as evidenced by poor attack transfer even between large models trained with identical recipes.
