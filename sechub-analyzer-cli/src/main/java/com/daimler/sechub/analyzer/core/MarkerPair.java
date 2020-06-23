package com.daimler.sechub.analyzer.core;

public class MarkerPair {
    private Marker start;
    private Marker end;
    
    public Marker getStart() {
        return start;
    }
    
    public void setStart(Marker start) {
        this.start = start;
    }
    
    public Marker getEnd() {
        return end;
    }
    
    public void setEnd(Marker end) {
        this.end = end;
    }
    
    @Override
    public String toString() {
        return "MarkerPair [start=" + start + ", end=" + end + "]";
    }
    
    @Override
    public int hashCode() {
        final int prime = 31;
        int result = 1;
        result = prime * result + ((end == null) ? 0 : end.hashCode());
        result = prime * result + ((start == null) ? 0 : start.hashCode());
        return result;
    }

    @Override
    public boolean equals(Object obj) {
        if (this == obj)
            return true;
        if (obj == null)
            return false;
        if (getClass() != obj.getClass())
            return false;
        MarkerPair other = (MarkerPair) obj;
        if (end == null) {
            if (other.end != null)
                return false;
        } else if (!end.equals(other.end))
            return false;
        if (start == null) {
            if (other.start != null)
                return false;
        } else if (!start.equals(other.start))
            return false;
        return true;
    }
}
