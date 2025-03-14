\A=\[\n
\Z=\]\n
\"geometries\"\:\[<u>\]\}=@Cleanup{@ProcessGeometry{$1}}
!!  (begin)\n\n$1\n(parse)\n
ProcessGeometry:\[<NumE>,<NumE>,<NumE>\]=\ \ \ $0,\n
ProcessGeometry:\[=\{\"lineString\"\:\[\n
ProcessGeometry:\]\,=\]\},\n
ProcessGeometry:\]=\]\},\n
ProcessGeometry:,=
ProcessGeometry:?=($0)
ProcessGeometry:\Z=\n
!! (end)\n
?=

NumE:<N>e<N>=$0@end
NumE:<N>=$0@end
NumE:=@fail

Cleanup:,\W\]=\]