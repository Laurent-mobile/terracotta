' launch.vbs
' Ce script lance l'application sans afficher de fenêtre noire

' Créer l'objet pour exécuter des commandes
Set WshShell = CreateObject("WScript.Shell")

' Lancer le script batch en mode caché
' 0 = fenêtre invisible
' False = ne pas attendre la fin du script
WshShell.Run "C:\MesApplications\TERRACOTTA2\start-app.bat", 0, False

' Optionnel : Attendre 5 secondes que le serveur démarre
WScript.Sleep 5000

' Optionnel : Ouvrir le navigateur automatiquement
WshShell.Run "http://localhost:5173", 1, False
