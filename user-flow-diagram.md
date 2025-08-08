# Dynalis User Flow Diagram

```mermaid
flowchart TD
    A[User Visits App] --> B{Authenticated?}
    B -->|No| C[Login/Register]
    C --> D[Dashboard]
    B -->|Yes| D[Dashboard]
    
    D --> E{Choose Action}
    E -->|Upload New Data| F[Data Upload Page]
    E -->|View Existing Data| G[Browse Sites Data]
    E -->|Check Upload Status| H[View Upload Jobs]
    
    F --> I[Select File]
    I --> J{File Valid?}
    J -->|No| K[Show Error Message]
    K --> I
    J -->|Yes| L[Parse & Validate Data]
    
    L --> M{Data Valid?}
    M -->|No| N[Show Validation Errors]
    N --> O[Fix Data or Choose New File]
    O --> I
    
    M -->|Yes| P[Data Staging Page]
    P --> Q[Preview Data]
    Q --> R{User Reviews Data}
    
    R -->|Edit/Modify| S[Make Changes]
    S --> Q
    R -->|Cancel| T[Discard Upload]
    T --> D
    R -->|Confirm Upload| U[Start Batch Processing]
    
    U --> V[Create Upload Job]
    V --> W[Show Progress Modal]
    W --> X{Job Status}
    
    X -->|Processing| Y[Real-time Updates]
    Y --> Z[Update Progress Bar]
    Z --> X
    
    X -->|User Cancels| AA[Mark Job as Cancelled]
    AA --> BB[Cleanup Cancelled Records]
    BB --> CC[Show Cancellation Success]
    CC --> D
    
    X -->|Completed Successfully| DD[Show Success Message]
    DD --> EE[Update Sites Database]
    EE --> FF[Job Complete]
    FF --> D
    
    X -->|Failed| GG[Show Error Details]
    GG --> HH[Provide Retry Options]
    HH -->|Retry| V
    HH -->|Cancel| D
    
    G --> II[Browse Sites Table]
    II --> JJ[Filter/Search Sites]
    JJ --> KK{Actions Available}
    KK -->|Edit Site| LL[Edit Site Details]
    KK -->|Delete Site| MM[Confirm Deletion]
    KK -->|Export Data| NN[Download CSV/Excel]
    
    LL --> OO[Save Changes]
    OO --> II
    MM --> PP[Delete Confirmation]
    PP --> II
    NN --> QQ[Generate Export File]
    QQ --> D
    
    H --> RR[View Upload Jobs List]
    RR --> SS{Job Actions}
    SS -->|View Details| TT[Show Job Progress]
    SS -->|Cancel Active Job| UU[Cancel Job Process]
    SS -->|Retry Failed Job| VV[Restart Job]
    
    TT --> RR
    UU --> AA
    VV --> V

    classDef startEnd fill:#e1f5fe
    classDef process fill:#f3e5f5
    classDef decision fill:#fff3e0
    classDef error fill:#ffebee
    classDef success fill:#e8f5e8
    
    class A,D startEnd
    class F,P,W,II,RR process
    class B,E,J,M,R,X,KK,SS decision
    class K,N,GG error
    class DD,FF,CC success
```

## Key User Journey Paths

### Primary Upload Flow
1. **Authentication** → Dashboard → Data Upload
2. **File Selection** → Validation → Data Staging
3. **Review & Confirm** → Batch Processing → Real-time Monitoring
4. **Completion** → Return to Dashboard

### Data Management Flow
1. **Dashboard** → Browse Sites Data
2. **Search/Filter** → Edit/Delete/Export
3. **Save Changes** → Return to Browse

### Job Monitoring Flow
1. **Dashboard** → View Upload Jobs
2. **Job Details** → Cancel/Retry Actions
3. **Status Updates** → Return to Dashboard

### Error Handling Paths
- File validation errors → Re-upload
- Data validation errors → Fix and re-stage
- Processing failures → Retry or cancel
- Job cancellation → Cleanup and return

## Real-time Features
- Live progress updates during batch processing
- Job status monitoring with WebSocket connections
- Cancellation capabilities with proper cleanup
- Background processing with user feedback