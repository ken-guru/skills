---
marp: true
theme: deck
title: How a request reaches our database
lang: en
paginate: true
---

<!-- _class: title -->

# How a request reaches our database

A first-week walkthrough for new engineers

<!--
Welcome everyone. This takes about ten minutes. [S1]
-->

---

<!-- _class: visual -->

## The request path

<!-- Visual intent: diagram showing that only cache misses reach the API, which then queues slow work -->

![A request passes the CDN and reaches the API only on a cache miss; the API then queues the work](media/request-path.svg)

Most requests never get past the CDN.

<!--
Walk the path left to right. The long description: 1. The browser sends a request. 2. The CDN answers from cache when it can. 3. On a miss, the API handles it. 4. Slow work goes to the job queue. [S1]
-->

---

<!-- _class: split -->

## Traffic keeps growing

- Requests doubled this year
- The queue absorbs the peaks

<!-- Visual intent: chart of monthly requests per quarter; the point is that traffic doubled in a year -->

![Requests rose from 12 to 24 million per month between Q1 and Q4](media/requests.svg)

Source: platform metrics, 2026

<!--
Data table:

| quarter | requests |
| --- | --- |
| Q1 | 12 |
| Q4 | 24 |
-->

---

## What to remember

![](media/rule.svg) <!-- decorative -->

- The CDN protects the API
- The queue protects the database

<!--
Close by asking which part they want to read the code for first.
-->

---

<!-- _class: quote -->

## In their words

> Make the common case fast.

A long-standing engineering maxim

<!--
Pause after the quote.
-->
