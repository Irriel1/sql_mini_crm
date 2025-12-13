import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";

export default function MovementsPage() {
  const { token, isLoading: authLoading, isAuthenticated } = useAuth();

  const [movements, setMovements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");}