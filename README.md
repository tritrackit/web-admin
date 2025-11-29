# Tri-TrackIT Web

RFID-Enabled Warehouse Tracking System --- Frontend Application

Tri-TrackIT Web is the Angular-based frontend dashboard for TriMotors
Technology Corporation's RFID-enabled tracking system. It provides
real-time monitoring of Complete Built Units (CBUs), system
configuration, secure authentication, and interactive warehouse
operations.

This project forms the frontend component of the Tri-TrackIT ecosystem,
which integrates IoT hardware, backend services, and real-time
communication technologies.

------------------------------------------------------------------------

## Table of Contents

-   Overview
-   Key Features
-   System Architecture
-   Technology Stack
-   Project Structure
-   Installation
-   Running the Application
-   Environment Configuration
-   Scripts
-   Dependencies
-   Real-Time Communication
-   Testing
-   Deployment
-   Hardware Integration
-   Data Collection and Analysis
-   Ethical Considerations
-   License

------------------------------------------------------------------------

## Overview

Tri-TrackIT is an RFID-enabled warehouse tracking system designed to
monitor CBU movement across multiple warehouse checkpoints.

The Tri-TrackIT Web application acts as the main user interface,
offering:

-   Real-time monitoring of unit movement\
-   CBU registration and management\
-   Secure login and role-based access\
-   Visual analytics and system metrics\
-   Integration with backend APIs and WebSocket-based updates

The system is built to streamline operational workflows, improve
tracking accuracy, and enhance data visibility across TriMotors'
logistics processes.

------------------------------------------------------------------------

## Key Features

-   Real-time CBU movement tracking\
-   Automatic dashboard updates through WebSocket events (PusherJS)\
-   Secure OAuth2-based authentication and role-based access control\
-   CBU registration using warehouse-issued RFID devices\
-   Responsive layout for desktop, laptop, tablet, and mobile\
-   Built-in analytics and visualization through ApexCharts

------------------------------------------------------------------------

## System Architecture

Hardware Data Flow:\
RFID Scanner → LoRa → ESP32 Gateway → Wi-Fi → NestJS Backend →
PostgreSQL Database → PusherJS → Angular Frontend

Frontend Responsibilities: - Fetch and display backend data via REST
APIs\
- Authenticate users and maintain access sessions\
- Subscribe to PusherJS channels for real-time updates\
- Display CBU logs, movement history, and status\
- Provide administrative dashboards and tools

------------------------------------------------------------------------

## Technology Stack

### Frontend

-   Angular 18\
-   Angular Material\
-   RxJS\
-   ApexCharts / ng-apexcharts\
-   Moment.js\
-   NGX Libraries (e.g., ngx-webcam, ngx-image-cropper,
    ngx-mat-select-search)

### Backend (External)

-   NestJS\
-   PostgreSQL\
-   TypeORM\
-   OAuth2\
-   PusherJS

### Hardware Layer

-   ESP32 LoRa Gateways\
-   NFC-based handheld RFID scanners

------------------------------------------------------------------------

## Project Structure

    src/
     ├─ app/
     │   ├─ auth/
     │   ├─ constant/
     │   ├─ guard/
     │   ├─ interceptors/
     │   ├─ model/
     │   ├─ pages/
     │   ├─ services/
     │   └─ shared/
     ├─ assets/
     │   ├─ fonts/
     │   ├─ img/
     │   └─ config.json
     ├─ environments/
     │   ├─ environment.ts
     │   └─ environment.prod.ts
     ├─ index.html
     ├─ main.ts
     └─ styles.scss

------------------------------------------------------------------------

## Installation

### 1. Clone the repository

``` bash
git clone https://github.com/tritrackit/web-admin.git
cd web-admin/
```

### 2. Install dependencies

``` bash
npm install
```

------------------------------------------------------------------------

## Running the Application

### Development server

``` bash
npm start
```

Accessible at: http://localhost:4200/

### Production build

``` bash
npm run build:prod
```

### Serve production build

``` bash
npm run start:server
```

------------------------------------------------------------------------

## Environment Configuration

### Development (environment.ts)

    export const environment = {
      production: false,
      apiBaseUrl: "http://localhost:3001/api/v1",
      idleTimeoutMinutes: 30,
      pusher: {
        key: "525752a480ad973116be",
        cluster: "ap1",
      }
    };

### Production (environment.prod.ts)

    export const environment = {
      production: true,
      apiBaseUrl: "https://tritrackit-api.vercel.app/api/v1",
      idleTimeoutMinutes: 30,
      pusher: {
        key: "525752a480ad973116be",
        cluster: "ap1",
      }
    };

------------------------------------------------------------------------

## Scripts

  Script                 Description
  ---------------------- -----------------------------------
  npm start              Starts Angular development server
  npm run build          Builds the application
  npm run build:prod     Builds the production version
  npm run watch          Development watch mode
  npm run start:server   Serves production build
  npm test               Runs Karma/Jasmine unit tests

------------------------------------------------------------------------

## Dependencies (Summary)

### Core Framework

-   @angular/core\
-   @angular/common\
-   @angular/router\
-   @angular/forms

### Realtime / Communication

-   pusher\
-   pusher-js

### UI & Visualization

-   @angular/material\
-   apexcharts\
-   ng-apexcharts\
-   ngx-image-cropper\
-   ngx-skeleton-loader\
-   ngx-timeago

### Utility

-   moment\
-   moment-timezone\
-   rxjs

------------------------------------------------------------------------

## Real-Time Communication

The application subscribes to PusherJS channels to receive:

-   CBU movement updates\
-   Registration changes\
-   Status modifications

These updates propagate instantly across all connected dashboards
without requiring manual refresh.

------------------------------------------------------------------------

## Testing

### Unit Testing

Frontend components are tested using:

-   Jasmine\
-   Karma

### Integration Testing

-   Postman for API validation\
-   Pusher Debug Console for real-time event checks

### Performance Testing

-   Chrome DevTools\
-   Lighthouse audits

------------------------------------------------------------------------

## Deployment

Typical deployment steps:

1.  Build the frontend application.\
2.  Upload the build output located in /dist/tritrackit-web/browser to a
    hosting provider (e.g., Vercel, Netlify, Nginx server).\
3.  Configure environment variables for API/Base URLs.\
4.  Ensure backend and Pusher services are operational and accessible.\
5.  Enable HTTPS for secure communication.

------------------------------------------------------------------------

## Hardware Integration

The frontend interfaces with the broader Tri-TrackIT hardware ecosystem:

-   Handheld NFC RFID Scanners\
    Used by warehouse staff to scan CBUs at checkpoints.

-   ESP32 LoRa Gateways\
    Transmit RFID scan data via Wi-Fi to the backend server.

-   Backend → Frontend Communication\
    Processed events trigger immediate dashboard updates.

------------------------------------------------------------------------

## Data Collection and Analysis

The system collects the following data for analysis:

-   RFID scan logs\
-   Timestamps and movement data\
-   System accuracy and response metrics\
-   User feedback through surveys and interviews\
-   Expert evaluations from logistics personnel

Used for evaluating performance, reliability, and operational efficiency
compared to manual warehouse processes.

------------------------------------------------------------------------

## Ethical Considerations

-   No personal employee data is collected.\
-   RFID tracking is limited strictly to vehicle units.\
-   Role-based access and OAuth2 secure all access points.\
-   All transmitted data is protected through secure protocols.\
-   Participants in evaluations are informed and may withdraw at any
    time.

------------------------------------------------------------------------

## License

This project is proprietary software developed for TriMotors Technology
Corporation. Redistribution or modification is not permitted without
written authorization.
